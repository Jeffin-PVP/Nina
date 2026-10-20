const { AttachmentBuilder, MessageFlags } = require("discord.js");

const VoiceRecordingRepository = require("../../database/repositories/VoiceRecordingRepository");
const VoiceRecordingManager = require("../../managers/VoiceRecordingManager");
const RecordingApi = require("../../services/RecordingService");

/*
=========================
    /voicepanel — INTERAÇÕES
=========================
customIds:
  voicerec:home | start | stop | list
  voicerec:view:<id> | dl:<id> | tr:<id> | dltr:<id>
  voicerec_select:pick

Todo botão revalida permissão e servidor: um painel antigo ou repassado
nunca dá acesso a quem não tem o cargo, nem a gravações de outro servidor.
*/

const EPHEMERAL = MessageFlags.Ephemeral;

async function deny(interaction, content) {
    const payload = { content, flags: EPHEMERAL };

    if (interaction.deferred || interaction.replied) {
        return interaction.followUp(payload);
    }

    return interaction.reply(payload);
}

async function authorize(interaction) {
    if (!interaction.inGuild() || !interaction.member) {
        await deny(interaction, "Este painel só funciona dentro de um servidor.");
        return null;
    }

    const settings = await VoiceRecordingRepository.get(interaction.guild.id);

    if (!settings.enabled) {
        await deny(interaction, "A gravação de calls está desativada neste servidor.");
        return null;
    }

    if (!VoiceRecordingManager.canRecord(interaction.member, settings)) {
        await deny(interaction, "Você não tem um cargo autorizado a usar a gravação de calls.");
        return null;
    }

    return settings;
}

const ctx = interaction => ({ guild: interaction.guild, member: interaction.member });

async function loadRecording(interaction, id) {
    const recording = await VoiceRecordingRepository.getRecording(interaction.guild.id, id);

    if (!recording) {
        await deny(interaction, "Não encontrei essa gravação neste servidor.");
        return null;
    }

    return recording;
}

function apiErrorMessage(error) {
    if (error instanceof RecordingApi.RecordingApiError) {
        if (error.code === "not_found") return "A gravação não existe mais no serviço de áudio.";
        if (error.code === "not_configured") return "O serviço de gravação não está configurado.";
        if (error.code === "unsupported") return "Neste modo só a transcrição é guardada; o áudio não é salvo.";
        return "O serviço de gravação está indisponível agora. Tente novamente em instantes.";
    }

    return "Não consegui concluir essa ação agora.";
}

/*
=========================
    BOTÕES
=========================
*/

async function execute(interaction) {
    const [, action, arg] = interaction.customId.split(":");

    // Mesmo com a gravação desativada, só o painel inicial pode avisar o motivo.
    if (!await authorize(interaction)) return;

    const base = ctx(interaction);

    if (action === "home") {
        return interaction.update(await VoiceRecordingManager.buildHome(base));
    }

    if (action === "list") {
        return interaction.update(await VoiceRecordingManager.buildList(base));
    }

    if (action === "start") {
        await interaction.deferUpdate();

        const channel = interaction.member.voice?.channel;

        if (!channel) {
            return interaction.editReply(await VoiceRecordingManager.buildHome({ ...base, notice: "Entre em um canal de voz primeiro." }));
        }

        const result = await VoiceRecordingManager.start({ ...base, channel });

        const notice = result.ok
            ? (result.announced
                ? "Gravação iniciada! Os participantes foram avisados no chat do canal."
                : "Gravação iniciada, mas não consegui avisar no chat do canal. Avise os participantes manualmente.")
            : result.error;

        return interaction.editReply(await VoiceRecordingManager.buildHome({ ...base, notice }));
    }

    if (action === "stop") {
        await interaction.deferUpdate();

        const session = VoiceRecordingManager.getSession(interaction.guild.id);
        const channel = interaction.member.voice?.channel;
        const sameChannel = session && channel && session.channel.id === channel.id;

        if (!session) {
            return interaction.editReply(await VoiceRecordingManager.buildHome({ ...base, notice: "Não há gravação em andamento." }));
        }

        if (!sameChannel && !VoiceRecordingManager.isManager(interaction.member)) {
            return interaction.editReply(await VoiceRecordingManager.buildHome({ ...base, notice: "Entre no canal que está sendo gravado para encerrar a gravação." }));
        }

        const result = await VoiceRecordingManager.stop(interaction.guild.id, "manual");

        const notice = result.ok
            ? "Gravação encerrada! O áudio está sendo processado — veja em **Ver gravações**."
            : (result.error || "A gravação foi encerrada, mas o serviço de áudio não confirmou o arquivo.");

        return interaction.editReply(await VoiceRecordingManager.buildHome({ ...base, notice }));
    }

    // A partir daqui todas as ações são sobre uma gravação específica.
    const recording = await loadRecording(interaction, arg);
    if (!recording) return;

    if (action === "view") {
        await interaction.deferUpdate();
        const fresh = await VoiceRecordingManager.refreshRecording(recording);
        return interaction.editReply(await VoiceRecordingManager.buildDetail({ ...base, recording: fresh }));
    }

    if (action === "tr") {
        await interaction.deferUpdate();

        let current = await VoiceRecordingManager.refreshRecording(recording);
        let notice;

        if (current.status !== "ready") {
            notice = "O áudio ainda está sendo processado. Tente de novo em instantes.";
        } else if (current.transcript_status === "pending") {
            notice = "A transcrição já está em andamento.";
        } else if (current.transcript_status === "ready") {
            notice = "Esta gravação já foi transcrita.";
        } else {
            try {
                current = await VoiceRecordingManager.requestTranscription(current);
                notice = "Transcrição solicitada! Use **Atualizar status** até ela ficar pronta.";
            } catch (error) {
                console.error("[Gravação] Falha ao solicitar transcrição:", error.message);
                notice = apiErrorMessage(error);
            }
        }

        return interaction.editReply(await VoiceRecordingManager.buildDetail({ ...base, recording: current, notice }));
    }

    if (action === "dl") {
        await interaction.deferReply({ flags: EPHEMERAL });

        const current = await VoiceRecordingManager.refreshRecording(recording);

        if (!RecordingApi.supportsAudio(current.remote_id)) {
            return interaction.editReply({ content: "Esta gravação não tem áudio guardado: neste modo só a transcrição fica salva." });
        }

        if (current.status !== "ready") {
            return interaction.editReply({ content: "O áudio ainda não está pronto para download." });
        }

        try {
            const { buffer, extension } = await RecordingApi.downloadAudio(current.remote_id, {
                maxBytes: VoiceRecordingManager.attachmentLimitBytes(interaction.guild)
            });

            return interaction.editReply({
                content: "Aqui está a gravação. Ela contém a voz dos participantes: compartilhe com cuidado.",
                files: [new AttachmentBuilder(buffer, { name: `gravacao-${VoiceRecordingManager.fileStamp(current)}.${extension}` })]
            });
        } catch (error) {
            if (error.code === "too_large") {
                return interaction.editReply({
                    content: "O áudio é grande demais para anexar no Discord. Baixe pelo **painel web da Nina** (seção Gravações)."
                });
            }

            console.error("[Gravação] Falha ao baixar áudio:", error.message);
            return interaction.editReply({ content: apiErrorMessage(error) });
        }
    }

    if (action === "dltr") {
        await interaction.deferReply({ flags: EPHEMERAL });

        try {
            const current = await VoiceRecordingManager.refreshRecording(recording);
            const result = await VoiceRecordingManager.buildTranscriptFile(interaction.guild, current);

            if (!result.ready) {
                return interaction.editReply({ content: "A transcrição ainda não está pronta. Tente de novo em instantes." });
            }

            if (current.transcript_status !== "ready") {
                await VoiceRecordingRepository.patch(current.guild_id, current.id, { transcript_status: "ready" });
            }

            return interaction.editReply({
                content: "Aqui está a transcrição.",
                files: [new AttachmentBuilder(result.buffer, { name: `transcricao-${VoiceRecordingManager.fileStamp(current)}.txt` })]
            });
        } catch (error) {
            console.error("[Gravação] Falha ao baixar transcrição:", error.message);
            return interaction.editReply({ content: apiErrorMessage(error) });
        }
    }
}

/*
=========================
    MENU DE SELEÇÃO
=========================
*/

async function select(interaction) {
    if (!await authorize(interaction)) return;

    const recording = await loadRecording(interaction, interaction.values[0]);
    if (!recording) return;

    await interaction.deferUpdate();

    const fresh = await VoiceRecordingManager.refreshRecording(recording);
    return interaction.editReply(await VoiceRecordingManager.buildDetail({ ...ctx(interaction), recording: fresh }));
}

module.exports = { execute, select };
