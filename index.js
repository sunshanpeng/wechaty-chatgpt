import { WechatyBuilder } from 'wechaty';
import qrcodeTerminal from 'qrcode-terminal';
import { ChatGPTAPI } from 'chatgpt';
let sessionToken = '';
const api = new ChatGPTAPI({ sessionToken: sessionToken || process.env.SESSION_TOKEN });
await api.ensureAuth();
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
  .on('message', async message => {
    const contact = message.talker();
    const content = message.text();
    const isText = message.type() === wechaty.Message.Type.Text;
    if (message.self() || !isText) {
      return;
    }
    console.log(`contact: ${contact} content: ${content}`);
    if (content === 'ding') {
      await contact.say('dong');
    }
    if (content.startsWith('/c ')) {
      const request = content.replace('/c ', '');
      console.log(`contact: ${contact} request: ${request}`);
      const response = await api.sendMessage(request);
      console.log(`contact: ${contact} response: ${response}`);
      try {
        await contact.say(response);
      } catch (e) {
        console.error(e);
      }
    }
  });
wechaty
  .start()
  .then(() => console.log('Start to log in wechat...'))
  .catch(e => console.error(e));