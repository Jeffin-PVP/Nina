/*
=========================
    EMOJIS DA NINA (UI)
=========================
Os ícones "ui_*" ficam no Developer Portal (Application Emojis).
No ClientReady o bot busca todos eles e passa a usá-los automaticamente.
Se algum não existir (ou o fetch falhar), cai no emoji Unicode padrão,
então nenhum comando quebra por falta de emoji.
*/

const registry = require("../config/emojiRegistry");
const FALLBACK = registry.FALLBACK_UI;

const NinaEmojiManager = require("../ai/NinaEmojiManager");

const PREFIX = "ui_";

const cache = new Map();

/** Busca os emojis da aplicação e guarda em cache. */
async function sync(client) {

    try {

        const emojis = await client.application.emojis.fetch();

        cache.clear();
        registry.setLive(emojis.values());

        for (const emoji of emojis.values()) {

            // Emoji da moeda Níquel: procura pelo ID e pelo nome na lista de emojis da aplicação.
            if (emoji.id === "1560347086199722035" || emoji.name?.toLowerCase() === "niquel") {
                cache.set("coin", {
                    id: emoji.id,
                    name: emoji.name,
                    animated: Boolean(emoji.animated),
                    text: emoji.toString()
                });
            }

            if (!emoji.name?.startsWith(PREFIX)) continue;

            cache.set(emoji.name.slice(PREFIX.length), {
                id: emoji.id,
                name: emoji.name,
                animated: Boolean(emoji.animated),
                text: emoji.toString()
            });

        }

        if (cache.has("coin")) {
            console.log(`🪙 Emoji Níquel carregado: ${cache.get("coin").text}`);
        } else {
            console.warn("⚠️ Emoji personalizado Níquel não encontrado nos emojis da aplicação; usando 🪙. Confira se o emoji está em Developer Portal > sua aplicação > Emojis.");
        }

        console.log(`✨ Emojis de interface carregados: ${cache.size} (${Object.keys(FALLBACK).filter(name => !cache.has(name)).length} do conjunto base usando Unicode)`);

        // Expressões da Nina (Nina_*): usa os IDs reais da aplicação.
        const ausentes = NinaEmojiManager.sync(emojis);

        if (ausentes.length) {
            console.warn(`⚠️ Emojis Nina_* não encontrados na aplicação (usando ID de reserva): ${ausentes.join(", ")}`);
        }

    } catch (error) {

        console.warn("⚠️ Não foi possível carregar os emojis da aplicação (usando Unicode):", error.message);

    }

}

/** Texto do emoji para usar em embeds/mensagens. */
function e(name) {

    return cache.get(name)?.text ?? registry.E(name);

}

/** Formato aceito por botões e select menus (.setEmoji / emoji:). */
function component(name) {

    const custom = cache.get(name);

    if (custom) return { id: custom.id, name: custom.name, animated: custom.animated };

    return registry.component(name);

}

module.exports = {
    sync,
    e,
    component,
    names: Object.keys(FALLBACK),
    PREFIX
};
