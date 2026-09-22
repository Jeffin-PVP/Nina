// Guarda um histórico curto por canal, só para dar continuidade
// natural à conversa (não é persistido — reseta ao reiniciar o bot).

const MAX_MESSAGES = 12; // 6 pares pergunta/resposta

const history = new Map();

class ConversationMemory {

    static get(channelId) {

        return history.get(channelId) ?? [];

    }

    static push(channelId, role, content) {

        const current = history.get(channelId) ?? [];

        current.push({ role, content });

        while (current.length > MAX_MESSAGES) {
            current.shift();
        }

        history.set(channelId, current);

    }

    static clear(channelId) {

        history.delete(channelId);

    }

}

module.exports = ConversationMemory;
