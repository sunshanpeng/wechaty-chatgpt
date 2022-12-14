# 12月14日更新
- openai加强了登录检测，基于sessionToken方式需要增加cf_clearance，但是有效期只有2个小时。
- 基于账号密码登录的方式需要有境外服务器或者能够代理到境外。
- 最近有很多使用UOS协议（包括本项目）登录微信的号被封。

在找到好的解决方法之前，不建议使用本项目。


# 基于wechaty创建一个自己的ChatGPT机器人

## 流程

### 注册ChatGPT账号

- 注册地址: <https://chat.openai.com/chat>
- 国内注册教程: <https://juejin.cn/post/7173447848292253704>

### 登录ChatGPT获取SESSION_TOKEN

- 打开网页: <https://chat.openai.com/chat>
- 打开开发者工具->应用->Cookie
- 拷贝`__Secure-next-auth.session-token`的值
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2777249/1670287051371-acd694da-cd3f-46c4-97c4-96438965f8a4.png#averageHue=%232d3136&clientId=uf4023d0a-0da7-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=497&id=u77b3570c&margin=%5Bobject%20Object%5D&name=image.png&originHeight=994&originWidth=1586&originalType=binary&ratio=1&rotation=0&showTitle=false&size=796464&status=done&style=none&taskId=uf4e7e669-4feb-431a-80b7-f7ab47c9113&title=&width=793)

### 安装机器人

#### Docker安装

```bash
export SESSION_TOKEN=上一步中拷贝的`__Secure-next-auth.session-token`的值 

docker run -e SESSION_TOKEN="$(echo $SESSION_TOKEN)" --rm -it registry.cn-hangzhou.aliyuncs.com/sunshanpeng/wechaty-chatgpt:0.0.8
```

#### 源码安装

```bash
git clone https://github.com/sunshanpeng/wechaty-chatgpt.git
cd wechaty-chatgpt
```

```bash
export SESSION_TOKEN=上一步中拷贝的`__Secure-next-auth.session-token`的值 
// install dependencies
npm i
// run
npm run chatgpt
```

### 使用机器人

- 扫码登录

<img src="./media/screenshot-20221207-130656.png" width="600"/>

- 测试ding-dong
- /c 使用chatgpt

<img src="./media/screenshot-20221207-131138.png" width="400"/>

## 感谢

- <https://github.com/wechaty/wechaty/>
- <https://github.com/transitive-bullshit/chatgpt-api>
