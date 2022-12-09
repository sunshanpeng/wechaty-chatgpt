import { WechatyBuilder } from 'wechaty';
import qrcodeTerminal from 'qrcode-terminal';
import { ChatGPTAPI } from 'chatgpt';

let sessionToken = '';
const api = new ChatGPTAPI({ sessionToken: sessionToken || process.env.SESSION_TOKEN });
await api.ensureAuth();
const conversationPool = new Map();

const wechaty = WechatyBuilder.build({
  name: 'wechaty-chatgpt',
  puppet: 'wechaty-puppet-wechat',
  puppetOptions: {
    uos: true,
  },
});
wechaty
  .on('scan', async (qrcode, status) => {
    qrcodeTerminal.generate(qrcode); // 在console端显示二维码
    const qrcodeImageUrl = ['https://api.qrserver.com/v1/create-qr-code/?data=', encodeURIComponent(qrcode)].join('');
    console.log(qrcodeImageUrl);
  })
  .on('login', user => console.log(`User ${user} logged in`))
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
      if (friendship.type() === wechaty.Friendship.Type.Receive) {
        await friendship.accept();
      }
      if (friendship.type() === wechaty.Friendship.Type.Confirm) {
        const contact = friendship.contact();
        await contact.say('你好呀，我是chatgpt小助手，可以把我拉到群里和大家一起玩，也可以单独发/chatgpt 指令来召唤我哦');
        await contact.say('/chatgpt 讲个笑话');
      }
    } catch (e) {
      console.error(e);
    }
  })
  .on('message', async message => {
    const contact = message.talker();
    const receiver = message.listener();
    let content = message.text();
    const room = message.room();
    const isText = message.type() === wechaty.Message.Type.Text;
    if (!isText) {
      return;
    }
    if (room) {
      const topic = await room.topic();
      if (await message.mentionSelf()) {
        let receiverName = '';
        if (receiver) {
          // 支持修改机器人群聊昵称  https://github.com/sunshanpeng/wechaty-chatgpt/issues/3
          const alias = await room.alias(receiver);
          receiverName = alias || receiver.name();
        }
        const groupContent = content.replace(`@${receiverName}`, '');
        console.log(`groupContent:${groupContent}`);
        if (groupContent) {
          content = groupContent.trim();
          if (!content.startsWith('/c')) {
            // 支持在群里@直接调用
            await chatgptReply(room, content);
          }
        } else {
          //todo 光@，没内容
          console.log(`@ event emit. room name: ${topic} contact: ${contact} content: ${content}`);
        }
      }
      console.log(`room name: ${topic} contact: ${contact} content: ${content}`);
      reply(room, content);
    } else {
      console.log(`contact: ${contact} content: ${content}`);
      reply(contact, content);
    }
  });
wechaty
  .start()
  .then(() => console.log('Start to log in wechat...'))
  .catch(e => console.error(e));

async function reply(contact, content) {
  content = content.trim();
  if (content === 'ding') {
    await send(contact, 'dong');
  }
  if (content.startsWith('/c ')) {
    const request = content.replace('/c ', '');
    await chatgptReply(contact, request);
  }
  if (content.startsWith('/chatgpt ')) {
    const request = content.replace('/chatgpt ', '');
    await chatgptReply(contact, request);
  }
}

async function chatgptReply(contact, request) {
  console.log(`contact: ${contact} request: ${request}`);
  let response = '出了一点小问题，请稍后重试下...';
  try {
    const conversation = await getConversion(contact);
    response = await conversation.sendMessage(request);
    console.log(`contact: ${contact} response: ${response}`);
  } catch (e) {
    console.error(e);
    // 尝试刷新token
    if (await !api.getIsAuthenticated()) {
      // 刷新失败，需要重新登录
      console.error('Unauthenticated');
      response = 'ChatGPT账号权限过期，需要管理员重新登录后才能继续使用';
    }
  }
  response = `${request} \n ------------------------ \n` + response;
  await send(contact, response);
}

async function getConversion(contact) {
  // 支持会话上下文 https://github.com/sunshanpeng/wechaty-chatgpt/issues/1
  let conversation = conversationPool.get(contact.id);
  if (!conversation) {
    conversation = api.getConversation();
    conversationPool.set(contact.id, conversation);
  }
  return conversation;
}

async function send(contact, message) {
  try {
    await contact.say(message);
  } catch (e) {
    console.error(e);
  }
}
