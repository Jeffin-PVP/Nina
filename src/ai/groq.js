const Groq = require("groq-sdk");

module.exports = new Groq({
    apiKey: process.env.GROQ_API_KEY
});