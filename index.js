import { BingChat } from 'bing-chat-patch';
import { ChatGPTAPI } from 'chatgpt';
import dotenv from 'dotenv';
import { FileBox } from 'file-box';

import { Configuration, OpenAIApi } from 'openai';
import qrcodeTerminal from 'qrcode-terminal';
import { Readable } from 'stream';
import { WechatyBuilder } from 'wechaty';

dotenv.config();

const api3 = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
});

const api4 = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
  apiBaseUrl: process.env.apiBaseUrl,
});

const api_bing = new BingChat({
  cookie: process.env.BING_COOKIE
})

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);



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
  .on('room-join', async (room, inviteeList, inviter) => {
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

    if (!isAudio && !isText) {
      return;
    }

    if (isAudio && currentAdminUser) {
      // 解析语音转文字
      try {
        const audio = await message.wechaty.puppet.messageFile(message.payload.id);
        const audioReadStream = Readable.from(audio.stream);
        audioReadStream.path = 'conversation.wav';
        const response = await openai.createTranscription(audioReadStream, 'whisper-1')
        content = response?.data?.text
      } catch (error) {
        console.log(`createTranscription has error: ${error.message}`)
        retrun
      }

    }

    if (room) {
      if (await message.mentionSelf()) {
        if (receiver) {
          // 支持修改机器人群聊昵称  https://github.com/sunshanpeng/wechaty-chatgpt/issues/3
          await room.alias(receiver);
          receiverName = alias || receiver.name();
        }

        const groupContent = content.replace(`@${receiverName}`, '');

        if (groupContent) {
          await chatgptReply(room, contact, content);
        }
        //如果管理员艾特别人不处理
      } else if (currentAdminUser && !content.startsWith('@')) {
        await chatgptReply(room, contact, content);
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

  const prefix = content.split(' ')[0]

  const keywords = ['/c', '/chatgpt', '/表情包', '/enable']

  const hit_prefix = keywords.includes(prefix)

  if (hit_prefix || currentAdminUser) {
    const request = hit_prefix ? content.replace(prefix, '') : content;

    if (!hit_prefix) {
      await chatgptReply(target, contact, request);
      return
    }

    switch (prefix) {
      case '/表情包':
        await send(target, await plugin_sogou_emotion(request))
        break;
      case '/enable':
        if (!currentAdminUser) {
          await send(target, '你无权操作此命令')
          break;
        }

        const temp_ai = request.trim()
        if (!api_map.hasOwnProperty(temp_ai)) {
          await send(target, `${temp_ai} not found`)
          break;
        }
        currentAI = temp_ai
        await send(target, `ok ${currentAI}`)
        break;

      default:
        await chatgptReply(target, contact, request);
        break;
    }
  }

}

async function chatgptReply(room, contact, request) {
  const topic = room && room.topic ? await room.topic() : 'none';
  console.log(`group:${topic} contact:${contact}  name:${contact.payload.alias} content: ${request}`);
  if (request && request.startsWith(receiverName)) {
    request = request.replace(receiverName, '').trim()
  }
  let response = FileBox.fromUrl('https://img02.sogoucdn.com/app/a/100520021/87DEAE7BAACE15B8CA451FC2645D6B3E',
    { name: `${new Date().getTime()}.gif` });
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

    console.log(`group:${topic} contact: ${contact} response: ${response}`);
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
    return FileBox.fromUrl(pic_url, { name: `${new Date().getTime()}.gif` })
  } catch (error) {
    console.error(`get sogou pic has error:${error.message}`)
    return null
  }
}