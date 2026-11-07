import {handle,method,send} from './_shared/utils.js';
// Informa ao site quais recursos opcionais estão ativos, sem expor nenhuma credencial.
export const pixEnabled=()=>Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN&&String(process.env.PUBLIC_SITE_URL||'').startsWith('https://'));
export default handle(async(req,res)=>{method(req,'GET');res.setHeader('Cache-Control','public, max-age=60');return res.status(200).json({pix:pixEnabled(),ai:Boolean(process.env.ANTHROPIC_API_KEY)})});
