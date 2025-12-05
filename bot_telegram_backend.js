const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const chalk = require('chalk');
const Redis = require('ioredis');
require('dotenv').config();

// ========== CONFIGURATION ==========
const botToken = process.env.BOT_TOKEN;
if (!botToken) {
    console.error('BOT_TOKEN is missing in .env');
    process.exit(1);
}
const bot = new Telegraf(botToken);

const API_URL = process.env.API_URL || 'https://roc-6-sdv-bges.site/api';
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID || -1002537753569;
const ADMIN_IDS = [913319004, 298974745, 851931779, 943209523, 571820015, 101722263, 114891561, 63352873, 110042692, 100539709, 5085656866, 1143912090, 99730157, 72726170, 267675364];

// Redis Connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => {
    console.error('Redis Error:', err);
});

// Admin credentials for API access
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

const mainMenuButtons = [
    ['HSI INDIBIZ', 'WMS Reguler', 'WMSLite', 'BITSTREAM'],
    ['VULA', 'ASTINET', 'METRO-E', 'VPN IP'],
    ['IP TRANSIT', 'SIP TRUNK', 'VOICE', 'IPTV'],
    ['METRANEXIA', 'LEPAS BI', 'QC2']
];

const DROPDOWN_OPTIONS = {
    tipeTransaksi: ['AO', 'PDA', 'MO', 'DO', 'SO', 'RO']
};

// ========== STATE MANAGEMENT ==========
async function getUserState(userId) {
    const data = await redis.get(`bot:user:${userId}`);
    return data ? JSON.parse(data) : null;
}

async function setUserState(userId, state) {
    if (state === null) {
        await redis.del(`bot:user:${userId}`);
    } else {
        await redis.set(`bot:user:${userId}`, JSON.stringify(state), 'EX', 86400); // 24 hours
    }
}

async function getAdminToken(userId) {
    return await redis.get(`bot:admin_token:${userId}`);
}

async function setAdminToken(userId, token) {
    await redis.set(`bot:admin_token:${userId}`, token, 'EX', 86400); // 24 hours
}

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
        await setAdminToken(userId, response.data.access_token);
        return response.data.access_token;
    } catch (error) {
        logError(`Login failed: ${error.message}`);
        return null;
    }
}

async function getOrLoginAdminToken(userId) {
    let token = await getAdminToken(userId);
    if (token) return token;
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
            const token = await getOrLoginAdminToken(userId);
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
            await redis.del(`bot:admin_token:${userId}`);
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
    await setUserState(userId, { step: 'mainMenu' });

    // User biasa - cek tiket aktif
    try {
        // Use first admin ID to authenticate request
        const result = await apiRequest('GET', '/tickets', null, ADMIN_IDS[0]);
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
                    `Anda tetap dapat membuat laporan baru.`,
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

// Command: /lapor - Shortcut untuk buat laporan baru
bot.command('lapor', async (ctx) => {
    logAction(ctx, 'Command /lapor');
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    const userId = ctx.from.id;
    await setUserState(userId, { step: 'mainMenu' });

    await ctx.reply(
        `Hi ${fullName}, silahkan pilih kategori produk untuk membuat laporan:`,
        Markup.inlineKeyboard(
            mainMenuButtons.map(row => row.map(text => Markup.button.callback(text, `main_${text}`)))
        )
    );
});

// Command: /status - Cek status tiket user
bot.command('status', async (ctx) => {
    logAction(ctx, 'Command /status');
    const usernameTelegram = ctx.from.username ? `@${ctx.from.username}` : '';

    if (!usernameTelegram) {
        return ctx.reply('❌ Anda perlu memiliki username Telegram untuk menggunakan fitur ini.');
    }

    try {
        const result = await apiRequest('GET', '/tickets', null, ADMIN_IDS[0]);
        if (result.success) {
            const userTickets = result.data.filter(t =>
                t.user_telegram_name?.toLowerCase() === usernameTelegram.toLowerCase()
            );

            if (userTickets.length === 0) {
                return ctx.reply(
                    '📋 *Status Tiket Anda*\n\n' +
                    'Anda belum memiliki tiket.\n' +
                    'Pilih menu /lapor atau /start untuk membuat laporan baru.',
                    { parse_mode: 'Markdown' }
                );
            }

            const activeTickets = userTickets.filter(t => t.status !== 'completed');
            const completedTickets = userTickets.filter(t => t.status === 'completed').slice(0, 5);

            let message = '*📋 Status Tiket Anda*\n\n';

            if (activeTickets.length > 0) {
                message += '*Tiket Aktif:*\n';
                activeTickets.forEach(t => {
                    const status = t.status === 'in_progress' ? '🔵 In Progress' : '🟡 Pending';
                    message += `• ${t.ticket_number} - ${status}\n`;
                });
                message += '\n';
            }

            if (completedTickets.length > 0) {
                message += '*Tiket Selesai (5 terakhir):*\n';
                completedTickets.forEach(t => {
                    message += `• ${t.ticket_number} - ✅ Resolved\n`;
                });
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } else {
            // API returned error
            await ctx.reply('❌ Gagal mengambil data tiket. Silakan coba lagi nanti.');
        }
    } catch (error) {
        logError(`Error fetching tickets: ${error}`);
        await ctx.reply('❌ Terjadi kesalahan saat mengambil data tiket. Silakan coba lagi nanti.');
    }
});

// Command: /bantuan - Panduan penggunaan bot
bot.command('bantuan', async (ctx) => {
    logAction(ctx, 'Command /bantuan');
    const helpText = `
*📖 Panduan Penggunaan Bot*

*Perintah Tersedia:*
/start - Mulai bot dan lihat menu utama
/lapor - Buat laporan/tiket baru
/status - Cek status tiket Anda
/bantuan - Lihat panduan ini

*Cara Membuat Laporan:*
1. Ketik /start atau /lapor
2. Pilih kategori produk
3. Isi data yang diminta
4. Tiket akan dibuat dan dikirim ke Helpdesk

*Status Tiket:*
🟡 Pending - Menunggu diambil agent
🔵 In Progress - Sedang dikerjakan
✅ Resolved - Sudah selesai

*Butuh bantuan lebih lanjut?*
Hubungi admin atau kirim pesan di grup support.
    `.trim();

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
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
    await setUserState(ctx.from.id, { step: 'mainMenu' });
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
        await setUserState(ctx.from.id, { step: 'metroEMenu', layanan: choice });
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
        await setUserState(ctx.from.id, { step: 'hsiMenu', layanan: 'HSI INDIBIZ' });
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
        await setUserState(ctx.from.id, { step: 'wmsMenu', layanan: 'WMS Reguler' });
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
        await setUserState(ctx.from.id, { step: 'wmsMenu', layanan: 'WMSLite' });
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
        await setUserState(ctx.from.id, { step: 'bitstreamMenu', layanan: 'BITSTREAM' });
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
        await setUserState(ctx.from.id, { step: 'bitstreamMenu', layanan: 'VULA' });
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
    } else if (choice === 'LEPAS BI') {
        await setUserState(ctx.from.id, { step: 'inputFormat', layanan: 'LEPAS BI', permintaan: 'LEPAS BI' });
        await ctx.editMessageText(
            `Anda memilih *LEPAS BI*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
            '```\n' +
            'ORDER: \n' +
            'BI ID: \n' +
            'CFS ID: \n' +
            'ID BI: \n' +
            'RFS ID: \n' +
            'KETERANGAN LAINNYA: -\n' +
            '```\n' +
            'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
            { parse_mode: 'Markdown' }
        );
    } else if (choice === 'QC2') {
        await setUserState(ctx.from.id, { step: 'qc2ProductMenu', layanan: 'QC2' });
        await ctx.editMessageText(
            'Pilih product untuk *QC2*:',
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('HSI', 'qc2_product_HSI'), Markup.button.callback('WIFI', 'qc2_product_WIFI'), Markup.button.callback('DATIN', 'qc2_product_DATIN')],
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
    await setUserState(ctx.from.id, { step: 'mainMenu' });
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
    let state = await getUserState(userId);

    if (!state || state.step !== 'hsiMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    state.step = 'inputFormat';
    state.permintaan = permintaan.replace('_', ' ');
    await setUserState(userId, state);

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
        `Anda memilih *HSI INDIBIZ - ${state.permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/wms_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;
    let state = await getUserState(userId);

    if (!state || state.step !== 'wmsMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    state.step = 'inputFormat';

    let template = '';
    if (permintaan === 'PUSH_BIMA') {
        state.permintaan = 'PUSH BIMA';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTASK BIMA: Pull Dropcore\nOWNERGROUP: TIF HD xxx\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        state.permintaan = 'TROUBLESHOOT';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE/SID: 16xxx / 05xxx / xxxx\nSN ONT: -\nSN AP: -\nMAC AP: -\nSSID: -\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'PUSH_BIMA_Lite') {
        state.permintaan = 'PUSH BIMA';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTASK BIMA: Pull Dropcore\nOWNERGROUP: TIF HD xxx\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT_Lite') {
        state.permintaan = 'TROUBLESHOOT';
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE/SID: 16xxx / 05xxx / xxxx\nSN ONT: -\nSSID: -\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nKETERANGAN LAINNYA: -';
    }

    await setUserState(userId, state);

    await ctx.editMessageText(
        `Anda memilih *${state.layanan} - ${state.permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/bitstream_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;
    let state = await getUserState(userId);

    if (!state || state.step !== 'bitstreamMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    state.step = 'inputFormat';
    state.permintaan = permintaan.replace('_', ' ');
    await setUserState(userId, state);

    let template = '';
    if (permintaan === 'RECONFIG') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: ZTEGxxxx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'REPLACE_ONT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: -\nSN LAMA: HWTCx\nSN BARU: ZTEGx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTIKET FO: INFxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: -\nTIPE ONT: -\nGPON SLOT/PORT: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *BITSTREAM - ${state.permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/vula_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;
    let state = await getUserState(userId);

    if (!state || state.step !== 'bitstreamMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    state.step = 'inputFormat';
    state.permintaan = permintaan.replace('_', ' ');
    await setUserState(userId, state);

    let template = '';
    if (permintaan === 'RECONFIG') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: ZTEGxxxx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'REPLACE_ONT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE: 16xxx / 05xxx\nPAKET INET: -\nSN LAMA: HWTCx\nSN BARU: ZTEGx\nTYPE ONT: F680\nGPON SLOT/PORT/ONU: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTIKET FO: INFxx\nND INET/VOICE: 16xxx / 05xxx\nPASSWORD: -\nPAKET INET: -\nSN ONT: -\nTIPE ONT: -\nGPON SLOT/PORT: GPON01-D6-KTB-3 SLOT 1 PORT 2 ONU 3\nSVLAN: -\nCVLAN: -\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *VULA - ${state.permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/metroE_(.+)/, async (ctx) => {
    const permintaan = ctx.match[1];
    const userId = ctx.from.id;
    let state = await getUserState(userId);

    if (!state || state.step !== 'metroEMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    state.step = 'inputFormat';
    state.permintaan = permintaan.replace('_', ' ');
    await setUserState(userId, state);

    let template = '';
    if (permintaan === 'PUSH_BIMA') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nTIKET FO: INFxx\nTASK BIMA: Pull Dropcore\nOWNERGROUP: -\nKETERANGAN LAINNYA: -';
    } else if (permintaan === 'TROUBLESHOOT') {
        template = 'TIPE TRANSAKSI: AO/PDA/MO/DO/SO/RO\nNOMOR ORDER: -\nWONUM: WOxxx\nND INET/VOICE/SID: -\nTASK BIMA: Pull Dropcore\nOWNERGROUP: -\nVLAN: -\nKETERANGAN LAINNYA: -';
    }

    await ctx.editMessageText(
        `Anda memilih *${state.layanan} - ${state.permintaan}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' + template + '\n```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

// ========== QC2 PRODUCT HANDLER ==========
bot.action(/qc2_product_(.+)/, async (ctx) => {
    const product = ctx.match[1];
    const userId = ctx.from.id;
    let state = await getUserState(userId);

    if (!state || state.step !== 'qc2ProductMenu') {
        return safeAnswerCbQuery(ctx, 'Silahkan mulai dengan perintah /start');
    }

    state.step = 'inputFormat';
    state.product = product;
    state.permintaan = 'QC2';
    state.layanan = `QC2 - ${product}`;
    await setUserState(userId, state);

    await ctx.editMessageText(
        `Anda memilih *QC2 - ${product}*. Silahkan salin dan sesuaikan format di bawah ini:\n\n` +
        '```\n' +
        'NOMOR ORDER: SCxxx\n' +
        'WONUM: WOxxx\n' +
        'ND INET/VOICE: 16xxx / 05xxx\n' +
        'KETERANGAN LAINNYA: -\n' +
        '```\n' +
        'Sesuaikan format dan balas pesan ini dengan format yang sudah disesuaikan dengan permintaan anda.',
        { parse_mode: 'Markdown' }
    );
});

// ========== INPUT PARSING HANDLER ==========
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    let state = await getUserState(userId);

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
            const result = await apiRequest('POST', '/tickets/bot-comments', commentData, ADMIN_IDS[0]); // Use first admin ID for auth

            if (result.success) {
                await ctx.reply(`✅ Balasan Anda untuk tiket *${ticketNumber}* berhasil dikirim.`, { parse_mode: 'Markdown' });

                // TODO: Enable group notifications in the future
                // const groupPesan = `*Balasan User untuk Tiket ${ticketNumber}*\nDari: ${username}\n\n${commentText}`;
                // await ctx.telegram.sendMessage(GROUP_CHAT_ID, groupPesan, { parse_mode: 'Markdown' });
            } else {
                logError(`Failed to send reply: ${result.error}`);
                console.log('[DEBUG] Full error details:', JSON.stringify(result, null, 2));
                await ctx.reply(`❌ Gagal mengirim balasan: ${result.error || 'Silahkan coba lagi nanti.'}`);
            }
        } catch (error) {
            logError(`Error replying comment: ${error}`);
            console.log('[DEBUG] Exception details:', error);
            await ctx.reply('❌ Terjadi kesalahan.');
        }

        await setUserState(userId, { step: 'mainMenu' });
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

    // ========== LEPAS BI VALIDATION ==========
    if (state.layanan === 'LEPAS BI') {
        const order = data['ORDER'];
        const biId = data['BI ID'];
        const cfsId = data['CFS ID'];
        const idBi = data['ID BI'];
        const rfsId = data['RFS ID'];
        const keteranganLain = data['KETERANGAN LAINNYA'] || '-';

        // Validate mandatory fields
        if (!order || !biId || !cfsId || !idBi || !rfsId) {
            await ctx.reply('*Format tidak sesuai.* Mohon isi semua field wajib untuk LEPAS BI.\nSilahkan ulangi dengan /start.', { parse_mode: 'Markdown' });
            await setUserState(userId, { step: 'mainMenu' });
            return;
        }

        state.inputData = {
            order: order,
            biId: biId,
            cfsId: cfsId,
            idBi: idBi,
            rfsId: rfsId,
            keteranganLain: keteranganLain,
            permintaan: state.permintaan,
            layanan: state.layanan,
            fullText: `ORDER: ${order}\nBI ID: ${biId}\nCFS ID: ${cfsId}\nID BI: ${idBi}\nRFS ID: ${rfsId}\nKETERANGAN LAINNYA: ${keteranganLain}`
        };

        const outputText = state.inputData.fullText;

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
        await setUserState(userId, state);
        return;
    }

    // ========== QC2 VALIDATION ==========
    if (state.permintaan === 'QC2') {
        const nomorOrder = data['NOMOR ORDER'];
        const wonum = data['WONUM'];
        const ndInetVoice = data['ND INET/VOICE'] || '-';
        const keteranganLain = data['KETERANGAN LAINNYA'] || '-';

        // Validate mandatory fields
        const nomorOrderValid = nomorOrder && nomorOrder.length > 0;
        const wonumValid = /^WO\d+$/i.test(wonum);
        const ndInetVoiceValid = ndInetVoice && ndInetVoice.length > 0;

        if (!nomorOrderValid || !wonumValid || !ndInetVoiceValid) {
            await ctx.reply('*Format tidak sesuai.* Mohon isi field wajib untuk QC2 dengan benar.\nSilahkan ulangi dengan /start.', { parse_mode: 'Markdown' });
            await setUserState(userId, { step: 'mainMenu' });
            return;
        }

        state.inputData = {
            nomorOrder,
            wonum,
            ndInetVoice,
            keteranganLain,
            permintaan: state.permintaan,
            layanan: state.layanan,
            fullText: `NOMOR ORDER: ${nomorOrder}\nWONUM: ${wonum}\nND INET/VOICE: ${ndInetVoice}\nKETERANGAN LAINNYA: ${keteranganLain}`
        };

        const outputText = state.inputData.fullText;

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
        await setUserState(userId, state);
        return;
    }

    // ========== STANDARD VALIDATION (OTHER PRODUCTS) ==========
    // Map data fields based on template keys
    const tipeTransaksi = data['TIPE TRANSAKSI'];
    const wonum = data['WONUM'];

    // Basic validation
    const tipeTransaksiValid = DROPDOWN_OPTIONS.tipeTransaksi.includes(tipeTransaksi);
    const wonumValid = /^WO\d+$/i.test(wonum);

    if (!tipeTransaksiValid || !wonumValid) {
        await ctx.reply('*Format tidak sesuai.* Mohon isi field wajib (TIPE TRANSAKSI, WONUM) dengan benar.\nSilahkan ulangi dengan /start.', { parse_mode: 'Markdown' });
        await setUserState(userId, { step: 'mainMenu' });
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
    await setUserState(userId, state);
});

bot.action('submit', async (ctx) => {
    const userId = ctx.from.id;
    let state = await getUserState(userId);

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
        permintaan: (input.permintaan === 'QC2' || input.permintaan === 'LEPAS BI') ? null : input.permintaan,
        tipe_transaksi: input.tipeTransaksi || '-',
        order_number: input.nomorOrder || input.order || '-',
        wonum: input.wonum || '-',
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
        keterangan_lainnya: input.keteranganLain,
        // Lepas BI fields
        bi_id: input.biId,
        cfs_id: input.cfsId,
        id_bi: input.idBi,
        rfs_id: input.rfsId
    };

    try {
        const result = await apiRequest('POST', '/tickets', ticketData, ADMIN_IDS[0]); // Updated endpoint to /tickets

        if (!result.success) {
            await ctx.reply('Gagal membuat tiket. Silahkan coba lagi.');
            return;
        }

        const ticket = result.data;

        // Compose message for group
        // Compose message for group
        let title = `*PERMINTAAN ${escapeMarkdownV2(input.layanan)}`;
        if (input.permintaan && input.permintaan !== 'QC2' && input.permintaan !== 'LEPAS BI') {
            title += ` \\- ${escapeMarkdownV2(input.permintaan)}`;
        }
        title += '*\n';

        let messageText = title +
            `Ticket ID: \`${escapeMarkdownV2(ticket.ticket_number)}\`\n` +
            `User: _${escapeMarkdownV2(ctx.from.first_name)}_ \\(${escapeMarkdownV2(username)}\\)\n\n` +
            `Deskripsi:\n` +
            '```\n' + escapeMarkdownV2(description) + '\n```';

        // Send to group
        await ctx.telegram.sendMessage(GROUP_CHAT_ID, messageText, { parse_mode: 'MarkdownV2' });

        await ctx.replyWithMarkdown(`Data permintaan berhasil disubmit dan tiket telah dibuat dengan nomor tiket *${ticket.ticket_number}*. Terima kasih.`);
        await setUserState(userId, { step: 'mainMenu' });
    } catch (error) {
        logError(`Error submit ticket: ${error}`);
        await ctx.reply('Terjadi kesalahan saat submit data. Silahkan coba lagi.');
    }

    await ctx.answerCbQuery();
});

bot.action('ulang', async (ctx) => {
    const userId = ctx.from.id;
    await setUserState(userId, { step: 'mainMenu' });
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

bot.action(/^ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    try {
        const result = await apiRequest('GET', `/tickets/${ticketId}`, null, ctx.from.id);
        if (!result.success) return ctx.answerCbQuery('Data tiket tidak ditemukan.');
        const ticket = result.data;

        await setUserState(ctx.from.id, {
            step: 'confirmTakeTicket',
            ticketId: ticket.id,
            ticketNumber: ticket.ticket_number,
            ticketUserTelegramId: ticket.user_telegram_id
        });

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
    const state = await getUserState(ctx.from.id);
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
                await ctx.telegram.sendMessage(state.ticketUserTelegramId, userPesan, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        Markup.button.callback('💬 Balas', `reply_ticket_${state.ticketId}`)
                    ])
                });
                console.log(`[DEBUG] Notification sent to user ${state.ticketUserTelegramId}`);
            } catch (err) {
                logError(`Failed to notify user ${state.ticketUserTelegramId}: ${err.message}`);
                console.log(`[DEBUG] Error details:`, err);
            }
        } else {
            console.log(`[DEBUG] No user ID found to notify.`);
        }

        await ctx.editMessageText('_Tiket berhasil diambil. Terima kasih._', { parse_mode: 'Markdown' });
        await setUserState(ctx.from.id, { step: 'mainMenu' });
    } catch (error) {
        logError(`Error taking ticket: ${error}`);
        await ctx.answerCbQuery('Terjadi kesalahan.');
    }
});

bot.action(/^myticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    try {
        const result = await apiRequest('GET', `/tickets/${ticketId}`, null, ctx.from.id);
        if (!result.success) return ctx.answerCbQuery('Data tiket tidak ditemukan.');
        const ticket = result.data;
        await setUserState(ctx.from.id, { step: 'confirmCloseTicket', ticketId: ticket.id, ticketNumber: ticket.ticket_number });
        const ticketDataText = formatTicketView(ticket);
        const msg = `Apakah anda ingin menyelesaikan tiket ini?\n` + '```\n' + ticketDataText + '```';
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([Markup.button.callback('YA', 'close_ticket'), Markup.button.callback('TIDAK', 'ulang_pickup')]) });
    } catch (error) {
        logError(`Error viewing my ticket: ${error}`);
        await ctx.answerCbQuery('Terjadi kesalahan.');
    }
});

bot.action('close_ticket', async (ctx) => {
    const state = await getUserState(ctx.from.id);
    if (!state || state.step !== 'confirmCloseTicket') return ctx.answerCbQuery('Tidak ada tiket yang dipilih.');
    const fullName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
    try {
        const updateData = { status: 'completed' };
        const result = await apiRequest('PUT', `/tickets/${state.ticketId}`, updateData, ctx.from.id);
        if (!result.success) return ctx.answerCbQuery('Gagal menyelesaikan tiket.');

        const pesan = `Tiket *${state.ticketNumber}* telah *SELESAI* dikerjakan oleh *${fullName}*. Terima kasih atas kerjasamanya.`;
        await ctx.telegram.sendMessage(GROUP_CHAT_ID, pesan, { parse_mode: 'Markdown' });

        await ctx.editMessageText('_Tiket berhasil diselesaikan. Terima kasih._', { parse_mode: 'Markdown' });
        await setUserState(ctx.from.id, { step: 'mainMenu' });
    } catch (error) {
        logError(`Error closing ticket: ${error}`);
        await ctx.answerCbQuery('Terjadi kesalahan.');
    }
});

bot.action('ulang_pickup', async (ctx) => {
    const userId = ctx.from.id;
    await setUserState(userId, { step: 'mainMenu' });
    const name = ctx.from.first_name || ctx.from.username || 'User';
    await ctx.editMessageText(
        `Hi ${name}, apa yang bisa saya bantu?`,
        Markup.inlineKeyboard(
            mainMenuButtons.map(row => row.map(text => Markup.button.callback(text, `main_${text}`)))
        )
    );
    await ctx.answerCbQuery();
});

bot.action('skip_ticket', async (ctx) => {
    const userId = ctx.from.id;
    await setUserState(userId, { step: 'mainMenu' });
    await ctx.editMessageText('_Anda membatalkan pengambilan tiket._', { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// ========== REPLY TICKET HANDLER ==========
bot.action(/^reply_ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    const userId = ctx.from.id;

    try {
        // Fetch ticket to get number and status
        const result = await apiRequest('GET', `/tickets/${ticketId}`, null, ADMIN_IDS[0]);
        if (!result.success) {
            return ctx.answerCbQuery('Gagal mengambil data tiket.');
        }
        const ticket = result.data;

        if (ticket.status === 'completed') {
            return ctx.answerCbQuery('Tiket sudah selesai, tidak dapat membalas.');
        }

        await setUserState(userId, {
            step: 'replyingComment',
            ticketId: ticketId,
            ticketNumber: ticket.ticket_number
        });

        await ctx.reply(
            `Silahkan ketik balasan Anda untuk tiket *${ticket.ticket_number}*:`,
            { parse_mode: 'Markdown' }
        );
        await ctx.answerCbQuery();
    } catch (error) {
        logError(`Error preparing reply: ${error}`);
        await ctx.answerCbQuery('Terjadi kesalahan.');
    }
});

// ========== BOT COMMANDS SETUP ==========
async function setupBotCommands() {
    const commands = [
        { command: 'start', description: 'Mulai bot dan lihat menu utama' },
        { command: 'lapor', description: 'Buat laporan/tiket baru' },
        { command: 'status', description: 'Cek status tiket saya' },
        { command: 'bantuan', description: 'Lihat panduan penggunaan bot' }
    ];

    try {
        await bot.telegram.setMyCommands(commands);
        logSuccess('Bot commands berhasil di-setup');
    } catch (error) {
        logError(`Gagal setup commands: ${error}`);
    }
}

// Start the bot
bot.launch().then(async () => {
    logSuccess('Bot Telegram Berjalan...');
    await setupBotCommands();
}).catch((err) => {
    logError(`Gagal menjalankan bot: ${err}`);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
