import { FileBox } from 'file-box';

export default class BingDrawClient {
    constructor(opts) {
        this.opts = opts
        if (!opts.baseUrl) {
            // 如果设置代理，走代理
            this.opts.baseUrl = 'https://www.bing.com'
        }
    }

    async getImages(prompt, contact) {
        let urlEncodedPrompt = encodeURIComponent(prompt)
        let url = `${this.opts.baseUrl}/images/create?q=${urlEncodedPrompt}&partner=sydney&rt=4&FORM=GENCRE`
        let headers = this.headers()
        let body = new FormData()
        body.append('q', prompt)
        body.append('qs', 'ds')
        let fetchOptions = {
            headers
        }

        let success = false
        let retry = 5
        let response
        while (!success && retry >= 0) {
            response = await fetch(url, Object.assign(fetchOptions, { body, redirect: 'manual', method: 'POST' }))

            // response.headers.forEach((value, key) => console.log(`${key} : ${value}`));
            try {
                let res = await response.text()

                if (res.toLowerCase().indexOf('this prompt has been blocked') > -1) {
                    throw new Error('Your prompt has been blocked by Bing. Try to change any bad words and try again.')
                }
            } catch (_) {

            }

            if (response.status !== 302) {
                url = `${this.opts.baseUrl}/images/create?q=${urlEncodedPrompt}&rt=3&FORM=GENCRE`
                response = await fetch(url, Object.assign(fetchOptions, { body, redirect: 'manual', method: 'POST' }))
            }

            if (response.status === 302) {
                success = true
                break
            } else {
                retry--
            }
        }
        if (!success) {
            throw new Error('绘图失败，请检查Bing token和代理/反代配置')
        }
        let redirectUrl = response.headers.get('Location').replace('&nfy=1', '')
        let requestId = redirectUrl.split('id=')[1]
        // 模拟跳转
        await fetch(`${this.opts.baseUrl}${redirectUrl}`, {
            headers
        })
        let pollingUrl = `${this.opts.baseUrl}/images/create/async/results/${requestId}?q=${urlEncodedPrompt}`
        console.log({ pollingUrl })
        console.log('waiting for bing draw results...')
        let timeoutTimes = 30
        let found = false
        let timer = setInterval(async () => {
            if (found) {
                return
            }
            let r = await fetch(pollingUrl, fetchOptions)
            let rText = await r.text()
            if (r.status === 200 && rText) {
                // logger.info(rText)
                console.log('got bing draw results!')
                found = true
                let regex = /src="([^"]+)"/g
                let imageLinks = rText.match(regex)
                if (!imageLinks || imageLinks.length === 0) {
                    // 很可能是微软内部error，重试即可
                    return
                }
                imageLinks = imageLinks.map(link => link.split('?w=')[0]).map(link => link.replace('src="', ''))
                imageLinks = [...new Set(imageLinks)]
                const badImages = [
                    'https://r.bing.com/rp/in-2zU3AJUdkgFe7ZKv19yPBHVs.png',
                    'https://r.bing.com/rp/TX9QuO3WzcCJz1uaaSwQAz39Kb0.jpg'
                ]
                for (let imageLink of imageLinks) {
                    if (imageLink.includes('cloudflare') || badImages.indexOf(imageLink) > -1) continue
                    console.log(`🖼️ ${prompt} :${imageLink}`)
                    await this.send(contact, FileBox.fromUrl(imageLink, { name: `${new Date().getTime()}.png` }))
                }
                // await this.send(contact, `剩余代币：${await this.getTokenBal()}`)

                clearInterval(timer)
            } else {
                if (timeoutTimes === 0) {
                    clearInterval(timer)
                    timer = null
                    throw new Error('绘图超时')
                } else {
                    timeoutTimes--
                }
            }
        }, 2000)
    }

    async send(contact, message) {
        try {
            await contact.say(message);
        } catch (e) {
            console.error(e);
        }
    }

    async getTokenBal() {
        let url = `${this.opts.baseUrl}/images/create/`
        let headers = this.headers()
        const api = await fetch(url, { headers: headers })
        const html = await api.text()
        var regex = /<div id="token_bal" aria-label=".*?">(\d+)<\/div>/;
        var match = html.match(regex);
        var token = match[1];
        return token
    }


    headers() {
        return {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'max-age=0',
            'content-type': 'application/x-www-form-urlencoded',
            referrer: 'https://www.bing.com/images/create/',
            origin: 'https://www.bing.com',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.50',
            cookie: this.opts.cookies || `_U=${this.opts.userToken}`,
            // 'x-forwarded-for': randomIp,
            Dnt: '1',
            'sec-ch-ua': '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
            'sec-ch-ua-arch': '"x86"',
            'sec-ch-ua-bitness': '"64"',
            'sec-ch-ua-full-version': '"113.0.5672.126"',
            'sec-ch-ua-full-version-list': '"Google Chrome";v="113.0.5672.126", "Chromium";v="113.0.5672.126", "Not-A.Brand";v="24.0.0.0"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-model': '',
            'sec-ch-ua-platform': '"macOS"',
            'sec-ch-ua-platform-version': '"13.1.0"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'Referrer-Policy': 'origin-when-cross-origin',
            'x-edge-shopping-flag': '1'
        }
    }


}

