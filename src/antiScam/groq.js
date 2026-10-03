const Groq = require("groq-sdk");

if (!process.env.ANTISCAM_GROQ_API_KEY) {
    throw new Error("ANTISCAM_GROQ_API_KEY não configurada.");
}

module.exports = new Groq({
    apiKey: process.env.ANTISCAM_GROQ_API_KEY
});
