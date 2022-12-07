
# 把ChatGPT装进微信里
基于wechaty创建一个自己的ChatGPT机器人

# 流程
## 注册ChatGPT账号
- 注册地址: https://chat.openai.com/chat
- 国内注册教程: https://juejin.cn/post/7173447848292253704
## 登录ChatGPT获取SESSION_TOKEN
- 打开网页: https://chat.openai.com/chat
- 打开开发者工具->应用->Cookie
- 拷贝`__Secure-next-auth.session-token`的值
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2777249/1670287051371-acd694da-cd3f-46c4-97c4-96438965f8a4.png#averageHue=%232d3136&clientId=uf4023d0a-0da7-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=497&id=u77b3570c&margin=%5Bobject%20Object%5D&name=image.png&originHeight=994&originWidth=1586&originalType=binary&ratio=1&rotation=0&showTitle=false&size=796464&status=done&style=none&taskId=uf4e7e669-4feb-431a-80b7-f7ab47c9113&title=&width=793)

## 启动机器人
```bash
git clone https://github.com/sunshanpeng/wechaty-chatgpt.git
cd wechaty-chatgpt
```
```javascript
export SESSION_TOKEN=上一步中拷贝的`__Secure-next-auth.session-token`的值 
// install dependencies
npm i
// run
npm run chatgpt
```
