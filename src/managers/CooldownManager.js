// Cooldown genérico, em memória, por comando + usuário.
// Comandos que precisam de cooldown persistente entre restarts (ex: daily,
// work) continuam usando seus próprios campos no banco — isso aqui é só
// pra evitar spam de comandos comuns (ex: jogos), sem precisar de banco.

const cooldowns = new Map(); // "comando:userId" -> expiresAt (timestamp)

// Verifica o cooldown e, se não estiver ativo, já marca o novo cooldown.
// Retorna 0 se pode usar, ou os ms restantes se ainda estiver de cooldown.
function check(commandName, userId, seconds) {

    const key = `${commandName}:${userId}`;
    const now = Date.now();
    const expiraEm = cooldowns.get(key);

    if (expiraEm && expiraEm > now) {

        return expiraEm - now;

    }

    cooldowns.set(key, now + seconds * 1000);

    return 0;

}

module.exports = { check };
