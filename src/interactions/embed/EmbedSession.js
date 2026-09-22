const sessions = new Map();

module.exports = {

    set(userId, data) {

        sessions.set(userId, data);

    },

    get(userId) {

        return sessions.get(userId);

    },

    delete(userId) {

        sessions.delete(userId);

    }

};