import { BingChat } from 'bing-chat-patch';
import { ChatGPTAPI } from 'chatgpt';
import dotenv from 'dotenv';
import { FileBox } from 'file-box';

import * as FS from 'fs';
import { Configuration, OpenAIApi } from 'openai';
import * as PATH from 'path';
import qrcodeTerminal from 'qrcode-terminal';
import Replicate from "replicate";
import { Readable } from 'stream';
import { WechatyBuilder } from 'wechaty';
import BingDrawClient from './plugin/bing-draw.js';
import { askDocument, loadDocuments, supportFileType } from './plugin/langchain.js';
dotenv.config();

const api3 = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
});

const api4 = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
  apiBaseUrl: process.env.apiBaseUrl,
});

const api_bing = new BingChat({
  cookie: process.env.BING_COOKIE,
})

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});




const api_map = { "api3": api3, "api4": api4, "api_bing": api_bing }

let currentAI = "api_bing"

let currentAdminUser = false

const conversationPool = new Map();

const wechaty = WechatyBuilder.build({
  name: 'wechaty-chatgpt',
  puppet: 'wechaty-puppet-wechat4u',
  puppetOptions: {
    uos: true,
  },
});
let receiverName = ''
wechaty
  .on('scan', async (qrcode, status) => {
    qrcodeTerminal.generate(qrcode, { small: true }); // 在console端显示二维码
    const qrcodeImageUrl = ['https://api.qrserver.com/v1/create-qr-code/?data=', encodeURIComponent(qrcode)].join('');
    console.log(qrcodeImageUrl);
  })
  .on('login', user => {
    receiverName = user.payload.name
    console.log(`User ${user} logged in`)
  }
  )
  .on('logout', user => console.log(`User ${user} has logged out`))
  .on('room-invite', async roomInvitation => {
    try {
      // 自动通过群聊邀请
      console.log(`received room-invite event.`);
      await roomInvitation.accept();
    } catch (e) {
      console.error(e);
    }
  })
  .on('room-join', async (room, inviteeList, inviter, date) => {
    console.log('received room-join event ');
  })
  .on('friendship', async friendship => {
    try {
      console.log(`received friend event from ${friendship.contact().name()}, messageType: ${friendship.type()}`);
    } catch (e) {
      console.error(e);
    }
  })
  .on('message', async message => {

    const contact = message.talker();
    currentAdminUser = contact.payload.alias === process.env.ADMIN
    const receiver = message.listener();
    let content = message.text().trim();
    const room = message.room();
    const isText = message.type() === wechaty.Message.Type.Text;
    const isAudio = message.type() === wechaty.Message.Type.Audio;

    const isFile = message.type() === wechaty.Message.Type.Attachment;

    if (isFile) {

      const filebox = await message.toFileBox()
      if (supportFileType(filebox.mediaType)) {
        await saveFile(filebox)
        await loadDocuments()
        await send(room || contact, `${filebox.name} Embeddings 成功`)
        return
      }

    }


    const topic = room && room.topic ? await room.topic() : 'none';

    if (!isAudio && !isText) {
      return;
    }

    console.log(`👂 onMessage group:${topic} contact:${contact.payload.name} ${contact.payload.alias} content: ${content}`);

    if (isAudio && currentAdminUser) {
      // 解析语音转文字
      try {
        // fixed const audio = await message.wechaty.puppet.messageFile(message.payload.id);
        // rawPayload.Content invalid
        // See: https://github.com/wechaty/puppet-wechat4u/blob/71369a09c1134d55fe9e1379b50b619a6c8a24cc/src/puppet-wechat4u.ts#L671
        const rawPayload = await wechaty.puppet.messageRawPayload(message.payload.id)
        const audioFileBox = FileBox.fromStream(
          (await wechaty.puppet.wechat4u.getVoice(rawPayload.MsgId)).data,
          `message-${message.payload.id}-audio.sil`,
        )

        const audioReadStream = Readable.from(audioFileBox.stream);
        audioReadStream.path = 'conversation.wav';
        const response = await openai.createTranscription(audioReadStream, 'whisper-1')
        content = response?.data?.text.trim()
      } catch (error) {
        console.error(`💥createTranscription has error: `, error)
        return;
      }

    }

    if (room) {
      if (await message.mentionSelf()) {
        if (receiver) {
          // 支持修改机器人群聊昵称  https://github.com/sunshanpeng/wechaty-chatgpt/issues/3
          await room.alias(receiver);
          receiverName = alias || receiver.name();
        }
        const groupContent = await message.mentionText();
        if (groupContent) {
          await reply(room, contact, groupContent);
        }
      }

    } else {
      // 私聊
      reply(null, contact, content);
    }
  });
wechaty
  .start()
  .then(() => console.log('Start to log in wechat...'))
  .catch(e => console.error(e));

async function reply(room, contact, content) {

  if (!content) {
    console.log(`empty message`)
    return
  }
  const target = room || contact;

  if (currentAdminUser && content === 'ding') {
    await send(target, 'dong');
    return
  }

  const prefix = content.split(' ')[0].trim()

  const keywords = [
    '/c',
    '/chatgpt',
    '/表情包',
    '/enable',
    '/画图',
    '/mj',
    '/doc',
  ]

  const hit_prefix = keywords.includes(prefix)
  let prompt = hit_prefix ? content.replace(prefix, '') : content;

  if (!hit_prefix) {
    await chatgptReply(target, contact, prompt);
    return
  }

  if (hit_prefix) {
    console.log(`🧑‍💻 onCommand or admin contact:${target} content: ${content}`);

    switch (prefix) {
      case '/表情包':
        await send(target, await plugin_sogou_emotion(prompt))
        break;
      case '/enable':
        if (!currentAdminUser) {
          await send(target, '你无权操作此命令')
          break;
        }

        const temp_ai = prompt.trim()
        if (!api_map.hasOwnProperty(temp_ai)) {
          await send(target, `${temp_ai} not found`)
          break;
        }
        currentAI = temp_ai
        await send(target, `ok ${currentAI}`)
        break;
      case '/画图':
        let client = new BingDrawClient({
          userToken: process.env.BING_COOKIE,
          baseUrl: `https://${process.env.BING_HOST}`
        })

        try {
          await client.getImages(prompt, target)
        } catch (err) {
          await send(target, '绘图失败：' + err)
        }

      case '/mj':
        prompt = hasChinese(prompt) ? await transToEnglish(prompt) : prompt
        const output = await replicate.run(
          "prompthero/openjourney:ad59ca21177f9e217b9075e7300cf6e14f7e5b4505b87b9689dbd866e9768969",
          {
            input: {
              prompt: `${prompt}`
            }
          }
        );

        for (let i = 0; i < output.length; ++i) {
          const url = output[i]
          console.log(`🖼️ ${prompt} ${url}`);
          await send(target, imageMessage(url))
        }
        break
      case '/doc':
        const res = await askDocument(prompt);
        await send(target, res)
        break;
      default:
        await chatgptReply(target, contact, prompt);
        break;
    }
  }

}

async function chatgptReply(room, contact, request) {
  if (request && request.startsWith(receiverName)) {
    request = request.replace(receiverName, '').trim()
  }
  let response = imageMessage('https://img02.sogoucdn.com/app/a/100520021/87DEAE7BAACE15B8CA451FC2645D6B3E', 'gif')
  try {
    let opts = {};
    // conversation
    let conversation = conversationPool.get(contact.id);
    if (conversation) {
      opts = conversation;
    }
    opts.timeoutMs = 2 * 60 * 1000;

    const api = api_map[currentAI]

    let res = await api.sendMessage(request, opts);
    response = res.text;

    const topic = room && room.topic ? await room.topic() : 'none';
    console.log(`👽️ group:${topic} contact: ${contact} response: ${response}`);
    conversation = {
      conversationId: res.conversationId,
      parentMessageId: res.id,
    };
    conversationPool.set(contact.id, conversation);
  } catch (e) {
    if (e.message === 'ChatGPTAPI error 429') {
      response = '🤯🤯🤯请稍等一下哦，我还在思考你的上一个问题';
    }
    console.error(e);
  }

  const target = room || contact;
  await send(target, response);
}

async function send(contact, message) {
  try {
    await contact.say(message);
  } catch (e) {
    console.error(e);
  }
}

async function plugin_sogou_emotion(keyword, random = true) {
  try {
    const url = `https://pic.sogou.com/napi/wap/emoji/searchlist?keyword=${keyword?.trim()}&spver=&rcer=&tag=0&routeName=emosearch`

    const api = await fetch(url)

    const resp = await api.json()

    const emotions = resp['data']['emotions']

    const index = random ? Math.floor((Math.random() * emotions.length)) : 0

    const pic_url = emotions[index]['thumbSrc']

    // 必须为 gif 结尾 否则将作为图片发送 https://github.com/nodeWechat/wechat4u/blob/f66fb69a352b4775210edd87d1101d7a165de797/src/wechat.js#L63
    return imageMessage(pic_url, 'gif')
  } catch (error) {
    console.error(`get sogou pic has error:${error.message}`)
    return null
  }
}

function imageMessage(url, ext = 'png') {
  return FileBox.fromUrl(url, { name: `${new Date().getTime()}.${ext}` })
}

async function transToEnglish(text) {
  try {
    const res = await api3.sendMessage(`你是一个翻译引擎，请翻译给出的文本为英文，只需要翻译不需要解释。 文本是${text}`)
    text = res.text
  } catch (error) {
  }
  return text
}

function hasChinese(str) {
  var pattern = /[\u4e00-\u9fa5]/; // 使用Unicode范围匹配中文字符
  return pattern.test(str);
}


async function saveFile(filebox, path = 'resource') {
  const audioReadStream = Readable.from(filebox.stream);
  const filePath = PATH.join(path, filebox.name);
  const writeStream = FS.createWriteStream(filePath);

  audioReadStream.pipe(writeStream);

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}