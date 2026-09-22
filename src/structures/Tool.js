class Tool {

    constructor({
        name,
        description,
        category,
        guildOnly = false,
        ownerOnly = false,
        permissions = [],
        parameters = {
            type: "object",
            properties: {},
            required: []
        }
    }) {

        this.name = name;
        this.description = description;
        this.category = category;
        this.guildOnly = guildOnly;
        this.ownerOnly = ownerOnly;
        this.permissions = permissions;
        this.parameters = parameters;

    }

    async execute(message, args = {}) {

        throw new Error(
            `A ferramenta "${this.name}" não implementou o método execute().`
        );

    }

    toJSON() {

        return {

            type: "function",

            function: {

                name: this.name,

                description: this.description,

                parameters: this.parameters

            }

        };

    }

}

module.exports = Tool;