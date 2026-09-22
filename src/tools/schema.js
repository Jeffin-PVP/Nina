const tools = require("./index");

module.exports = Object.values(tools).map(tool => ({

    type: "function",

    function: {

        name: tool.name,

        description: tool.description,

        parameters: tool.parameters || {

            type: "object",

            properties: {},

            required: []

        }

    }

}));