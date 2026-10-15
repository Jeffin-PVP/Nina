const { e } = require("../utils/emojis");

// Usa os emojis do iconpack quando disponiveis, com fallback Unicode.
module.exports = {
    status: {
        get on() { return e("ok"); },
        get off() { return e("error"); }
    }
};
