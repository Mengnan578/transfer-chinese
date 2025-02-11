## 介绍
这是一个lingui的中英文翻译的脚本，调用百度翻译的api，有额度限制，每个月五万字符
## 用法
1. 申请百度翻译的账号和key，在当前目录下创建.env文件,填入你的id和key如下
```js
BAIDU_APP_ID= 'xxxxxx'
BAIDU_SECRET_KEY= 'xxxx'
```
2. 然后npmi 下载依赖；
3. 设置index.js 中的输入（INPUT_PO_FILE） 和 输出（OUTPUT_PO_FILE） 的po文件路径为你自己的po文件全路径
4. 执行``` node index.js ```
