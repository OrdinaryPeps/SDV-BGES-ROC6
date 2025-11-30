const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const chalk = require('chalk');

// ========== CONFIGURATION ==========
const botToken = '8006797400:AAFGpaHzH5klYaL5VfAX_ueM-RVeQKXgrdo';
const bot = new Telegraf(botToken);

const API_URL = 'http://localhost:8001/api';
const GROUP_CHAT_ID = -1002537753569;
const ADMIN_IDS = [913319004, 298974745, 851931779, 943209523, 571820015, 101722263, 114891561, 63352873, 110042692, 100539709, 5085656866, 1143912090, 99730157, 72726170, 267675364];

// Admin credentials for API access
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

// In-memory storage
const adminTokens = {};
const userState = {};

const mainMenuButtons = [
    ['HSI INDIBIZ', 'WMS Reguler', 'WMSLite', 'BITSTREAM'],
    ['VULA', 'ASTINET', 'METRO-E', 'VPN IP'],
    ['IP TRANSIT', 'SIP TRUNK', 'VOICE', 'IPTV'],
    ['METRANEXIA']
];

const DROPDOWN_OPTIONS = {
    tipeTransaksi: ['AO', 'PDA', 'MO', 'DO', 'SO', 'RO']
};

// ========== LOGGING FUNCTIONS ==========
function logInfo(msg) { console.log(chalk.blue('[INFO]'), msg); }
function logSuccess(msg) { console.log(chalk.green('[SUCCESS]'), msg); }
function logWarn(msg) { console.log(chalk.yellow('[WARN]'), msg); }
function logError(msg) { console.log(chalk.red('[ERROR]'), msg); }
function logAction(ctx, action) {
    const user = ctx.from ? `${ctx.from.first_name} (@${ctx.from.username || '-'}) [${ctx.from.id}]` : '';
    console.log(chalk.magentaBright(`[ACTION] ${action}`), chalk.gray(user));
}

// ========== API HELPER FUNCTIONS ==========
async function loginAdmin(userId) {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, ADMIN_CREDENTIALS);
        adminTokens[userId] = response.data.access_token;
        return response.data.access_token;
    } catch (error) {
        logError(`Login failed: ${error.message}`);
        return null;
    }
}

async function getAdminToken(userId) {
    if (adminTokens[userId]) return adminTokens[userId];
    return await loginAdmin(userId);
}

async function apiRequest(method, endpoint, data = null, userId = null) {
    try {
        const config = {
            method,
            url: `${API_URL}${endpoint}`,
            headers: {}
        };

        if (userId && ADMIN_IDS.includes(userId)) {
            const token = await getAdminToken(userId);
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }

        if (data) {
            config.data = data;
            config.headers['Content-Type'] = 'application/json';
        }

        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        if (error.response?.status === 401 && userId) {
            delete adminTokens[userId];
            const token = await loginAdmin(userId);
            if (token) {
                return apiRequest(method, endpoint, data, userId);
            }
        }
        logError(`API Request failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ========== UTILITY FUNCTIONS ==========
function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '-';
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function formatTicketView(ticket) {
    let output = '';
    output += `Ticket Number: ${ticket.ticket_number}\n`;
    output += `Category: ${ticket.category}\n`;
    if (ticket.permintaan) output += `Permintaan: ${ticket.permintaan}\n`;
    if (ticket.wonum) output += `WONUM: ${ticket.wonum}\n`;
    if (ticket.nd_internet_voice) output += `ND: ${ticket.nd_internet_voice}\n`;
    output += `Description: ${ticket.description}\n`;
    output += `Status: ${ticket.status}\n`;
    output += `User: ${ticket.user_telegram_name}\n`;
    if (ticket.assigned_agent_name) {
        output += `Assigned Agent: ${ticket.assigned_agent_name}\n`;
    }
    output += `Created: ${new Date(ticket.created_at).toLocaleString()}\n`;
    return output;
}

async function safeAnswerCbQuery(ctx, text = null) {
    try {
        await ctx.answerCbQuery(text);
    } catch (e) {
        // Ignore
    }
}

// ========== BOT HANDLERS ==========
bot.start(async (ctx) => {
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    const usernameTelegram = ctx.from.username ? `@${ctx.from.username}` : '';
    const userId = ctx.from.id;
    userState[userId] = { step: 'mainMenu' };

    // User biasa - cek tiket aktif
    try {
        const result = await apiRequest('GET', '/tickets');
        if (result.success) {
            const activeTickets = result.data.filter(t =>
                t.user_telegram_name?.toLowerCase() === usernameTelegram.toLowerCase() &&
                t.status !== 'completed'
            );

            if (activeTickets.length >= 10) {
                let tiketList = activeTickets.map(t => `- *${t.ticket_number}*`).join('\n');
                await ctx.reply(
                    `Anda sudah memiliki maksimal 10 tiket aktif.\n` +
                    `Tiket aktif Anda:\n${tiketList}\n` +
                    `Silahkan menunggu sampai tiket RESOLVED sebelum membuat tiket baru. Terimakasih.`,
                    { parse_mode: 'Markdown' }
                );
                return;
            } else if (activeTickets.length > 0) {
                let tiketList = activeTickets.map(t => `- *${t.ticket_number}*`).join('\n');
                await ctx.reply(
                    `Attention: Anda masih mempunyai tiket laporan aktif:\n${tiketList}\n` +
                    `Anda tetap dapat membuat laporan baru.\n\nHi ${escapeMarkdownV2(fullName)}, apa yang bisa saya bantu?`,
                    { parse_mode: 'Markdown' }
                );
            }
        }
    } catch (error) {
        logError('Error cek tiket aktif:', error);
    }

    await ctx.reply(
        `Hi ${fullName}, apa yang bisa saya bantu?`,
        Markup.inlineKeyboard(
            mainMenuButtons.map(row => row.map(text => Markup.button.callback(text, `main_${text}`)))
        )
    );
});

bot.command('admin', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return; // Ignore non-admins
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    const username = fullName ? `(@${ctx.from.username})` : '';

    await ctx.reply(
        `Hi ${fullName} ${username}, User anda terdaftar sebagai Helpdesk. Semangat Pagi 💪 💪`,
        Markup.inlineKeyboard([
            [Markup.button.callback('GET OPEN TICKET', 'get_open_tiket'), Markup.button.callback('MY TICKET', 'my_pickup_tiket')]
        ])
    );
});

bot.action('admin_tool', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('Anda bukan admin.');
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    const username = fullName ? `(@${ctx.from.username})` : '';

    await ctx.editMessageText(
        `Hi ${fullName} ${username}, User anda terdaftar sebagai Helpdesk. Semangat Pagi 💪 💪`,
        Markup.inlineKeyboard([
            [Markup.button.callback('GET OPEN TICKET', 'get_open_tiket'), Markup.button.callback('MY TICKET', 'my_pickup_tiket')]
        ])
    );
});

bot.action('user_tool', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('Anda bukan admin.');
    const name = ctx.from.first_name || ctx.from.username || 'User';
    userState[ctx.from.id] = { step: 'mainMenu' };
    await ctx.editMessageText(
        `Hi ${name}, apa yang bisa saya bantu?`,
        Markup.inlineKeyboard(
            mainMenuButtons.map(row => row.map(text => Markup.button.callback(text, `main_${text}`)))
        )
    );
});

// ========== MENU HANDLERS ==========
bot.action(/main_(.+)/, async (ctx) => {
    const choice = ctx.match[1];
    const layananSamaMetode = ['METRO-E', 'ASTINET', 'VPN IP', 'IP TRANSIT', 'SIP TRUNK', 'VOICE', 'IPTV', 'METRANEXIA'];

    if (layananSamaMetode.includes(choice)) {
        userState[ctx.from.id] = { step: 'metroEMenu', layanan: choice };
        await ctx.editMessageText(
            `Anda memilih *${choice}*. Silahkan pilih permintaan anda`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('PUSH BIMA', 'metroE_PUSH_BIMA'), Markup.button.callback('TROUBLESHOOT', 'metroE_TROUBLESHOOT')],
                    [Markup.button.callback('« Kembali', 'back_main')]
                ])
            }
        );
    } else if (choice === 'HSI INDIBIZ') {
        userState[ctx.from.id] = { step: 'hsiMenu', layanan: 'HSI INDIBIZ' };
        await ctx.editMessageText(
            `Anda memilih *${choice}*. Silahkan pilih permintaan anda`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('RECONFIG', 'hsi_RECONFIG'), Markup.button.callback('REPLACE ONT', 'hsi_REPLACE_ONT')],
                    [Markup.button.callback('TROUBLESHOOT', 'hsi_TROUBLESHOOT'), Markup.button.callback('INTEGRASI', 'hsi_INTEGRASI')],
                    [Markup.button.callback('« Kembali', 'back_main')]
                ])
            }
        );
    } else if (choice === 'WMS Reguler') {
        userState[ctx.from.id] = { step: 'wmsMenu', layanan: 'WMS Reguler' };
        await ctx.editMessageText(
            `Anda memilih *WMS Reguler*. Silahkan pilih permintaan anda`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('PUSH BIMA', 'wms_PUSH_BIMA'), Markup.button.callback('TROUBLESHOOT', 'wms_TROUBLESHOOT')],
                    [Markup.button.callback('« Kembali', 'back_main')]
                ])
            }
        );
    } else if (choice === 'WMSLite') {
        userState[ctx.from.id] = { step: 'wmsMenu', layanan: 'WMSLite' };
        await ctx.editMessageText(
            `Anda memilih *WMS Lite*. Silahkan pilih permintaan anda`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('PUSH BIMA', 'wms_PUSH_BIMA_Lite'), Markup.button.callback('TROUBLESHOOT', 'wms_TROUBLESHOOT_Lite')],
                    [Markup.button.callback('« Kembali', 'back_main')]
                ])
            }
        );
    } else if (choice === 'BITSTREAM') {
        userState[ctx.from.id] = { step: 'bitstreamMenu', layanan: 'BITSTREAM' };
        await ctx.editMessageText(
            `Anda memilih *BITSTREAM*. Silahkan pilih permintaan anda`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('RECONFIG', 'bitstream_RECONFIG'), Markup.button.callback('REPLACE ONT', 'bitstream_REPLACE_ONT')],
                    [Markup.button.callback('TROUBLESHOOT', 'bitstream_TROUBLESHOOT')],
                    [Markup.button.callback('« Kembali', 'back_main')]
                ])
            }
        );
    } else if (choice === 'VULA') {
        userState[ctx.from.id] = { step: 'bitstreamMenu', layanan: 'VULA' };
        await ctx.editMessageText(
            `Anda memilih *VULA*. Silahkan pilih permintaan anda`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('RECONFIG', 'vula_RECONFIG'), Markup.button.callback('REPLACE ONT', 'vula_REPLACE_ONT')],
                    [Markup.button.callback('TROUBLESHOOT', 'vula_TROUBLESHOOT')],
                    [Markup.button.callback('« Kembali', 'back_main')]
                ])
            }
        );
    } else {
        await safeAnswerCbQuery(ctx, 'Fitur ini sedang dalam tahap pengembangan.');
    }
});

bot.action('back_main', async (ctx) => {
    const name = ctx.from.first_name || ctx.from.username || 'User';
    userState[ctx.from.id] = { step: 'mainMenu' };
    await ctx.editMessageText(
        `Hi ${name}, apa yang bisa saya bantu?`,
        Markup.inlineKeyboard(
            mainMenuButtons.map(row => row.map(text => Markup.button.callback(text, `main_${text}`)))
        )
    );
});

// ========== SUB-MENU HANDLERS ==========
bot.action(/hsi_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;

    if (!userState[userId] || userState[userId].step !== 'hsiMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    userState[userId].step = 'inputFormat';
    userState[userId].permintaan = permintaan.replace('_', ' ');

    let template = '';
    if (permintaan === 'RECONFIG') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: SCxxx\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: HSI100M\nSN ONT: ZTEGxxx\nTIPE ONT: F609V2\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'REPLACE_ONT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: SCxxx\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: HSI100M\nSN LAMA: ZTEGxxx\nSN BARU: ZTEGxxx\nTIPE ONT: F609V2\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: SCxxx\nWONUM: WOxxx\nTIKET FO: INFxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: HSI100M\nSN ONT: ZTEGxxx\nTIPE ONT: F609V2\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'INTEGRASI') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: SCxxx\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: HSI100M\nSN ONT: ZTEGxxx\nTIPE ONT: F609V2\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *HSI INDIBIZ - ${userState[userId].permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/wms_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;

    if (!userState[userId] || userState[userId].step !== 'wmsMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    userState[userId].step = 'inputFormat';

    let template = '';
    if (permintaan === 'PUSH_BIMA') {
        userState[userId].permintaan = 'PUSH BIMA';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTASK BIMA: Pull Dropcore\nOWNERGROUP: TIF HD xxx\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        userState[userId].permintaan = 'TROUBLESHOOT';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE/SID: 16xxx / 05xxx / xxxx\nSN ONT: -\nSN AP: -\nMAC AP: -\nSSID: -\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'PUSH_BIMA_Lite') {
        userState[userId].permintaan = 'PUSH BIMA';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTASK BIMA: Pull Dropcore\nOWNERGROUP: TIF HD xxx\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT_Lite') {
        userState[userId].permintaan = 'TROUBLESHOOT';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE/SID: 16xxx / 05xxx / xxxx\nSN ONT: -\nSSID: -\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *${userState[userId].layanan} - ${userState[userId].permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/bitstream_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;

    if (!userState[userId] || userState[userId].step !== 'bitstreamMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    userState[userId].step = 'inputFormat';
    userState[userId].permintaan = permintaan.replace('_', ' ');

    let template = '';
    if (permintaan === 'RECONFIG') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: ZTEGxxxx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'REPLACE_ONT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: -\nSN LAMA: HWTCx\nSN BARU: ZTEGx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTIKET FO: INFxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: -\nTIPE ONT: -\nGPON SLOT/PORT: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *BITSTREAM - ${userState[userId].permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/vula_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;

    if (!userState[userId] || userState[userId].step !== 'bitstreamMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    userState[userId].step = 'inputFormat';
    userState[userId].permintaan = permintaan.replace('_', ' ');

    let template = '';
    if (permintaan === 'RECONFIG') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: ZTEGxxxx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'REPLACE_ONT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: -\nSN LAMA: HWTCx\nSN BARU: ZTEGx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTIKET FO: INFxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: -\nTIPE ONT: -\nGPON SLOT/PORT: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *VULA - ${userState[userId].permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/metroE_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;

    if (!userState[userId] || userState[userId].step !== 'metroEMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    userState[userId].step = 'inputFormat';
    userState[userId].permintaan = permintaan.replace('_', ' ');

    let template = '';
    if (permintaan === 'PUSH_BIMA') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTIKET FO: INFxx\nTASK BIMA: Pull Dropcore\nOWNERGROUP: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE/SID: -\nTASK BIMA: Pull Dropcore\nOWNERGROUP: -\nVLAN: -\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *${userState[userId].layanan} - ${userState[userId].permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

// ========== INPUT PARSING HANDLER ==========
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userState[userId];

    if (!state) return;

    // Handle Reply Comment
    if (state.step === 'replyingComment') {
        const ticketNumber = state.ticketNumber;
        const commentText = ctx.message.text;
        const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

        try {
            const commentData = {
                ticket_number: ticketNumber,
                user_telegram_id: String(userId),
                user_telegram_name: username,
                comment: commentText
            };

            // Use special endpoint for bot to add comment
            const result = await apiRequest('POST', '/bot/comments', commentData, ADMIN_IDS[0]); // Use first admin ID for auth

            if (result.success) {
                await ctx.reply(`✅ Balasan Anda untuk tiket *${ticketNumber}* berhasil dikirim.`, { parse_mode: 'Markdown' });

                // Notify Group about user reply
                const groupPesan = `*Balasan User untuk Tiket ${ticketNumber}*\nDari: ${username}\n\n${commentText}`;
                await ctx.telegram.sendMessage(GROUP_CHAT_ID, groupPesan, { parse_mode: 'Markdown' });
            } else {
                await ctx.reply('❌ Gagal mengirim balasan. Silahkan coba lagi nanti.');
            }
        } catch (error) {
            logError(`Error replying comment: ${error}`);
            await ctx.reply('❌ Terjadi kesalahan.');
        }

        userState[userId] = { step: 'mainMenu' };
        return;
    }

    if (state.step !== 'inputFormat') {
        return; // Ignore if not in input step
    }

    const text = ctx.message.text;
    const lines = text.split('\n');
    const data = {};

    // Parse key-value pairs
    lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim().toUpperCase();
            const value = parts.slice(1).join(':').trim();
            data[key] = value;
        }
    });

    // Map data fields based on template keys
    const tipeTransaksi = data['TIPE TRANSAKSI'];
    const wonum = data['WONUM'];

    // Basic validation
    const tipeTransaksiValid = DROPDOWN_OPTIONS.tipeTransaksi.includes(tipeTransaksi);
    const wonumValid = /^WO\d+$/i.test(wonum);

    if (!tipeTransaksiValid || !wonumValid) {
        await ctx.reply('*Format tidak sesuai.* Mohon isi field wajib (TIPE TRANSAKSI, WONUM) dengan benar.\nSilahkan ulangi dengan /start.', { parse_mode: 'Markdown' });
        userState[userId] = { step: 'mainMenu' };
        return;
    }

    // Store parsed data
    state.inputData = {
        tipeTransaksi: data['TIPE TRANSAKSI'],
        nomorOrder: data['NOMOR ORDER'] || '-',
        wonum: data['WONUM'],
        ndInetVoice: data['ND INET/VOICE'] || data['ND INET/VOICE/SID'] || '-',
        tiketFO: data['TIKET FO'] || '-',
        password: data['PASSWORD'] || '-',
        paketInet: data['PAKET INET'] || '-',
        snLama: data['SN LAMA'] || '-',
        snBaru: data['SN BARU'] || '-',
        snOnt: data['SN ONT'] || '-',
        tipeOnt: data['TIPE ONT'] || data['TYPE ONT'] || '-',
        gpon: data['GPON SLOT/PORT/ONU'] || data['GPON SLOT/PORT'] || '-',
        vlan: data['VLAN'] || '-',
        svlan: data['SVLAN'] || '-',
        cvlan: data['CVLAN'] || '-',
        taskBima: data['TASK BIMA'] || '-',
        ownerGroup: data['OWNERGROUP'] || '-',
        snAp: data['SN AP'] || '-',
        macAp: data['MAC AP'] || '-',
        ssid: data['SSID'] || '-',
        keteranganLain: data['KETERANGAN LAINNYA'] || '-',
        permintaan: state.permintaan,
        layanan: state.layanan
    };

    // Generate confirmation message
    let outputText = '';
    for (const [key, value] of Object.entries(data)) {
        outputText += `${key}: ${value}\n`;
    }

    // Save the full formatted text for the ticket description
    state.inputData.fullText = outputText;

    await ctx.reply(
        `Format anda diterima, pastikan data sudah benar sebelum melakukan permintaan.\n\n` +
        '```\n' + outputText + '\n```\n',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('SUBMIT', 'submit'),
                Markup.button.callback('ULANGI', 'ulang')
            ])
        }
    );

    state.step = 'confirmSubmit';
});

bot.action('submit', async (ctx) => {
    const userId = ctx.from.id;
    const state = userState[userId];

    if (!state || state.step !== 'confirmSubmit') {
        return ctx.answerCbQuery('Tidak ada data untuk disubmit.');
    }

    const username = ctx.from.username ? `@${ctx.from.username}` : `@${ctx.from.first_name}`;
    const input = state.inputData;

    // Use the full formatted text as description
    const description = input.fullText || `${input.permintaan}\nWONUM: ${input.wonum}`;

    // Map to backend TicketCreate schema
    const ticketData = {
        user_telegram_id: String(userId),
        user_telegram_name: username,
        category: input.layanan,
        description: description,
        permintaan: input.permintaan,
        tipe_transaksi: input.tipeTransaksi,
        order_number: input.nomorOrder,
        wonum: input.wonum,
        tiket_fo: input.tiketFO,
        nd_internet_voice: input.ndInetVoice,
        password: input.password,
        paket_inet: input.paketInet,
        sn_lama: input.snLama,
        sn_baru: input.snBaru,
        sn_ap: input.snAp,
        mac_ap: input.macAp,
        ssid: input.ssid,
        tipe_ont: input.tipeOnt,
        gpon_slot_port: input.gpon,
        vlan: input.vlan,
        svlan: input.svlan,
        cvlan: input.cvlan,
        task_bima: input.taskBima,
        ownergroup: input.ownerGroup,
        keterangan_lainnya: input.keteranganLain
    };

    try {
        const result = await apiRequest('POST', '/webhook/telegram', ticketData);

        if (!result.success) {
            await ctx.reply('Gagal membuat tiket. Silahkan coba lagi.');
            return;
        }

        const ticket = result.data;

        // Compose message for group
        let messageText = `*PERMINTAAN ${escapeMarkdownV2(input.layanan)} \\- ${escapeMarkdownV2(input.permintaan)}*\n` +
            `Ticket ID: \`${escapeMarkdownV2(ticket.ticket_number)}\`\n` +
            `User: _${escapeMarkdownV2(ctx.from.first_name)}_ \\(${escapeMarkdownV2(username)}\\)\n\n` +
            `Deskripsi:\n` +
            '```\n' + escapeMarkdownV2(description) + '\n```';

        // Send to group
        await ctx.telegram.sendMessage(GROUP_CHAT_ID, messageText, { parse_mode: 'MarkdownV2' });

        await ctx.replyWithMarkdown(`Data permintaan berhasil disubmit dan tiket telah dibuat dengan nomor tiket *${ticket.ticket_number}*. Terima kasih.`);
        userState[userId] = { step: 'mainMenu' };
    } catch (error) {
        logError(`Error submit ticket: ${error}`);
        await ctx.reply('Terjadi kesalahan saat submit data. Silahkan coba lagi.');
    }

    await ctx.answerCbQuery();
});

bot.action('ulang', async (ctx) => {
    const userId = ctx.from.id;
    userState[userId] = { step: 'mainMenu' };
    const name = ctx.from.first_name || ctx.from.username || 'User';
    await ctx.editMessageText(
        `Hi ${name}, apa yang bisa saya bantu?`,
        Markup.inlineKeyboard(
            mainMenuButtons.map(row => row.map(text => Markup.button.callback(text, `main_${text}`)))
        )
    );
    await ctx.answerCbQuery();
});

// ========== ADMIN ACTIONS ==========
bot.action('get_open_tiket', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('Anda bukan admin.');
    try {
        const result = await apiRequest('GET', '/tickets/open/available', null, ctx.from.id);
        if (!result.success) {
            await ctx.editMessageText('_Terjadi kesalahan saat mengambil data tiket._', { parse_mode: 'Markdown' });
            return;
        }
        const openTickets = result.data;
        if (openTickets.length === 0) {
            await ctx.editMessageText('_Tidak ada tiket aktif dengan status OPEN._', { parse_mode: 'Markdown' });
            return;
        }
        const grouped = {};
        openTickets.forEach(t => {
            if (!grouped[t.category]) grouped[t.category] = [];
            grouped[t.category].push(t);
        });
        let text = '*Daftar tiket OPEN:*\n\n';
        const keyboard = openTickets.map(t => [Markup.button.callback(t.ticket_number, `ticket_${t.id}`)]);
        for (const kategori in grouped) {
            text += `*${kategori}*\n`;
            text += grouped[kategori].map(t => `- \`${t.ticket_number}\``).join('\n') + '\n\n';
        }
        await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) });
    } catch (error) {
        logError(`Error get_open_tiket: ${error}`);
        await ctx.editMessageText('_Terjadi kesalahan._', { parse_mode: 'Markdown' });
    }
});

bot.action('my_pickup_tiket', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('Anda bukan admin.');
    try {
        const usernameRaw = ctx.from.username || ctx.from.first_name || 'Agent';
        const username = usernameRaw.startsWith('@') ? usernameRaw : '@' + usernameRaw;
        const result = await apiRequest('GET', '/tickets', null, ctx.from.id);
        if (!result.success) {
            await ctx.editMessageText('_Terjadi kesalahan._', { parse_mode: 'Markdown' });
            return;
        }
        const myTickets = result.data.filter(t => t.status === 'in_progress' && t.assigned_agent_name?.toLowerCase() === username.toLowerCase());
        if (myTickets.length === 0) {
            await ctx.editMessageText('_Anda belum memiliki tiket yang sedang dikerjakan._', { parse_mode: 'Markdown' });
            return;
        }
        const grouped = {};
        myTickets.forEach(t => {
            if (!grouped[t.category]) grouped[t.category] = [];
            grouped[t.category].push(t);
        });
        let text = '*Daftar tiket yang sedang Anda kerjakan:*\n\n';
        const keyboard = myTickets.map(t => [Markup.button.callback(t.ticket_number, `myticket_${t.id}`)]);
        for (const kategori in grouped) {
            text += `*${kategori}*\n`;
            text += grouped[kategori].map(t => `- \`${t.ticket_number}\``).join('\n') + '\n\n';
        }
        await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) });
    } catch (error) {
        logError(`Error my_pickup_tiket: ${error}`);
        await ctx.editMessageText('_Terjadi kesalahan._', { parse_mode: 'Markdown' });
    }
});

bot.action(/ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    try {
        const result = await apiRequest('GET', `/tickets/${ticketId}`, null, ctx.from.id);
        if (!result.success) return ctx.answerCbQuery('Data tiket tidak ditemukan.');
        const ticket = result.data;
        userState[ctx.from.id] = {
            step: 'confirmTakeTicket',
            ticketId: ticket.id,
            ticketNumber: ticket.ticket_number,
            ticketUserTelegramId: ticket.user_telegram_id
        };
        console.log(`[DEBUG] Viewing ticket ${ticket.ticket_number}. User ID: ${ticket.user_telegram_id}`);
        const ticketDataText = formatTicketView(ticket);
        const msg = `Apakah anda ingin mengerjakan tiket ini?\n` + '```\n' + ticketDataText + '```\n' + `Pelapor: ${escapeMarkdownV2(ticket.user_telegram_name)}`;
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([Markup.button.callback('Ambil', 'take_ticket'), Markup.button.callback('Skip', 'skip_ticket')]) });
    } catch (error) {
        logError(`Error viewing ticket: ${error}`);
        await ctx.answerCbQuery('Terjadi kesalahan.');
    }
});

bot.action('take_ticket', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state || state.step !== 'confirmTakeTicket') return ctx.answerCbQuery('Tidak ada tiket yang dipilih.');
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    let username = ctx.from.username || ctx.from.first_name || 'Agent';
    if (!username.startsWith('@')) username = '@' + username;
    try {
        const updateData = { assigned_agent: 'agent_id_from_admin', assigned_agent_name: username, status: 'in_progress' };
        const result = await apiRequest('PUT', `/tickets/${state.ticketId}`, updateData, ctx.from.id);
        if (!result.success) return ctx.answerCbQuery('Gagal mengambil tiket.');
        const pesan = `Tiket *${state.ticketNumber}* sedang dikerjakan oleh agent kami *${fullName}*. Mohon untuk ditunggu, Terimakasih...`;
        await ctx.telegram.sendMessage(GROUP_CHAT_ID, pesan, { parse_mode: 'Markdown' });

        // Notify User
        console.log(`[DEBUG] Attempting to notify user. ID: ${state.ticketUserTelegramId}`);
        if (state.ticketUserTelegramId) {
            try {
                const userPesan = `Halo, Tiket Anda *${state.ticketNumber}* telah diambil oleh agent *${fullName}* dan sedang dalam pengerjaan. Mohon ditunggu update selanjutnya.`;
                await ctx.telegram.sendMessage(state.ticketUserTelegramId, userPesan, { parse_mode: 'Markdown' });
                console.log(`[DEBUG] Notification sent to user ${state.ticketUserTelegramId}`);
            } catch (err) {
                logError(`Failed to notify user ${state.ticketUserTelegramId}: ${err.message}`);
                console.log(`[DEBUG] Error details:`, err);
            }
        } else {
            console.log(`[DEBUG] No user ID found to notify.`);
        }

        await ctx.editMessageText('_Tiket berhasil diambil. Terima kasih._', { parse_mode: 'Markdown' });
        userState[ctx.from.id] = { step: 'mainMenu' };
    } catch (error) {
        logError(`Error taking ticket: ${error}`);
        await ctx.answerCbQuery('Terjadi kesalahan.');
    }
});

bot.action(/myticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    try {
        const result = await apiRequest('GET', `/tickets/${ticketId}`, null, ctx.from.id);
        if (!result.success) return ctx.answerCbQuery('Data tiket tidak ditemukan.');
        const ticket = result.data;
        userState[ctx.from.id] = { step: 'confirmCloseTicket', ticketId: ticket.id, ticketNumber: ticket.ticket_number };
        const ticketDataText = formatTicketView(ticket);
        const msg = `Apakah anda ingin menyelesaikan tiket ini?\n` + '```\n' + ticketDataText + '```';
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([Markup.button.callback('YA', 'close_ticket'), Markup.button.callback('TIDAK', 'ulang_pickup')]) });
    } catch (error) {
        logError(`Error viewing my ticket: ${error}`);
        await ctx.answerCbQuery('Terjadi kesalahan.');
    }
});

bot.action('close_ticket', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state || state.step !== 'confirmCloseTicket') return;
    try {
        const updateData = { status: 'completed' };
        const result = await apiRequest('PUT', `/tickets/${state.ticketId}`, updateData, ctx.from.id);
        if (!result.success) return ctx.answerCbQuery('Gagal menyelesaikan tiket.');
        const ticketResult = await apiRequest('GET', `/tickets/${state.ticketId}`, null, ctx.from.id);
        if (ticketResult.success) {
            const ticket = ticketResult.data;
            const pesan = `Tiket laporan *${state.ticketNumber}* sudah RESOLVED, silahkan diperiksa kembali ${escapeMarkdownV2(ticket.user_telegram_name)}\\. Terimakasih\\.\\.\\.`;
            await ctx.telegram.sendMessage(GROUP_CHAT_ID, pesan, { parse_mode: 'MarkdownV2' });
        }
        await ctx.editMessageText('_Tiket berhasil diselesaikan. Terima kasih._', { parse_mode: 'Markdown' });
        userState[ctx.from.id] = { step: 'mainMenu' };
    } catch (error) {
        logError(`Error closing ticket: ${error}`);
    }
});

bot.action('skip_ticket', async (ctx) => {
    await ctx.answerCbQuery();
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    const username = fullName ? `(@${ctx.from.username})` : '';
    await ctx.editMessageText(`Hi ${fullName} ${username}, User anda terdaftar sebagai Helpdesk. Semangat Pagi 💪 💪`, Markup.inlineKeyboard([[Markup.button.callback('GET OPEN TICKET', 'get_open_tiket'), Markup.button.callback('MY TICKET', 'my_pickup_tiket')]]));
});

bot.action('ulang_pickup', async (ctx) => {
    await ctx.answerCbQuery();
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    const username = fullName ? `(@${ctx.from.username})` : '';
    await ctx.editMessageText(`Hi ${fullName} ${username}, User anda terdaftar sebagai Helpdesk. Semangat Pagi 💪 💪`, Markup.inlineKeyboard([[Markup.button.callback('GET OPEN TICKET', 'get_open_tiket'), Markup.button.callback('MY TICKET', 'my_pickup_tiket')]]));
});

bot.action(/reply_comment_(.+)/, async (ctx) => {
    const ticketNumber = ctx.match[1];
    userState[ctx.from.id] = { step: 'replyingComment', ticketNumber: ticketNumber };
    await ctx.reply(
        `Silahkan ketik balasan Anda untuk tiket *${ticketNumber}*.\n` +
        `Balasan Anda akan dikirimkan ke agent yang menangani tiket ini.`,
        { parse_mode: 'Markdown' }
    );
    await ctx.answerCbQuery();
});

// ========== COMMENT NOTIFICATION ==========
setInterval(async () => {
    try {
        const result = await apiRequest('GET', '/comments/pending-telegram');
        if (result.success && result.data.length > 0) {
            for (const comment of result.data) {
                try {
                    const pesan = `*Update Tiket ${comment.ticket_number}*\nDari agent: ${comment.agent_username}\n\n${comment.comment}`;
                    await bot.telegram.sendMessage(GROUP_CHAT_ID, pesan, { parse_mode: 'Markdown' });

                    try {
                        // Send to user with Reply button
                        await bot.telegram.sendMessage(comment.user_telegram_id, pesan, {
                            parse_mode: 'Markdown',
                            ...Markup.inlineKeyboard([
                                Markup.button.callback('💬 Balas Pesan', `reply_comment_${comment.ticket_number}`)
                            ])
                        });
                    } catch (err) { }

                    await apiRequest('PUT', `/comments/${comment.comment_id}/mark-sent`);
                } catch (error) { logError(`Error sending comment: ${error.message}`); }
            }
        }
    } catch (error) { logError(`Error polling comments: ${error.message}`); }
}, 10000);

// Start bot
bot.launch().then(() => {
    logSuccess('Bot started and integrated with web dashboard');
    logInfo(`API URL: ${API_URL}`);
    logInfo(`Group Chat ID: ${GROUP_CHAT_ID}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
