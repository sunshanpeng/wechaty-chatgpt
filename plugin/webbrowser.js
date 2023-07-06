async function duckduckgo(searchWord, maxResults = 3) {
    const url = `https://duckduckgo.anysign.xyz/search?q=${searchWord}&max_results=${maxResults}`
    const api = await fetch(url)
    const res = await api.json()
    return res
}

async function extractDuckDuckgo(ai, searchResult, originPrompt) {
    const prompt = `今天是${new Date()} 我希望你在下面的JSON数组中到与问题最相关的json节点，不要更正,不要加其他任何内容

    ### JSON开始
    ${JSON.stringify(searchResult)}
    ### JSON结束
    
    Question: 示例问题 
    Helpful Answer: {"body": "","href": "","title": ""}
            
    Question:  ${originPrompt}
    Helpful Answer:`

    let result = {
        "body": null,
        "href": null,
        "title": null
    }

    try {
        const { text } = await ai.sendMessage(prompt)

        result = JSON.parse(text)
    } catch (error) {
        console.log(`extractDuckDuckgo has error:${error}`)
        result = searchResult[0]
    }
    return result
}

async function browerGetHtml(url) {
    try {
        const api = await fetch(url)
        const res = await api.text()
        return res
    } catch (error) {
        return ''
    }

}

async function chatWithHtml(ai, searchResult, originPrompt) {
    const prompt = `I will give you a question or an instruction. Your objective is to answer my question or fulfill my instruction.

    My question or instruction is: ${originPrompt}
    
    For your reference, today's date is  ${new Date()}
    
    It's possible that the question or instruction, or just a portion of it, requires relevant information from the internet to give a satisfactory answer or complete the task. Therefore, provided below is the necessary information obtained from the internet, which sets the context for addressing the question or fulfilling the instruction. You will write a comprehensive reply to the given question or instruction. Make sure to cite results using [[NUMBER](URL)] notation after the reference. If the provided information from the internet results refers to multiple subjects with the same name, write separate answers for each subject:
    """
    ${JSON.stringify(searchResult)}
    """
    Reply in 中文`
    try {
        const { text } = await ai.sendMessage(prompt)
        return text
    } catch (error) {
        return searchResult[0].body
    }

}

function extractURL(text) {
    var urlPattern = /(https?:\/\/[^\s]+)/g; // 匹配URL的正则表达式模式

    var urls = text.match(urlPattern); // 使用正则表达式匹配所有URL

    return urls && urls.length > 0 ? urls[0] : null;
}

export { browerGetHtml, chatWithHtml, duckduckgo, extractDuckDuckgo, extractURL }

