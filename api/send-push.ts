
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// INICIALIZAÇÃO DO SDK ADMIN (SINGLETON)
// Nota: Isto requer que as variáveis de ambiente estejam configuradas no Vercel.
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
if (!admin.apps.length) {
    try {
        // Tenta usar as variáveis de ambiente se existirem
        if (process.env.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    // Corrige formatação da chave privada (quebras de linha)
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        } else {
            console.warn("Aviso: Chaves do Firebase Admin não encontradas no ambiente.");
        }
    } catch (e) {
        console.error("Erro ao inicializar Firebase Admin:", e);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Verificação de Segurança Básica
    // Em produção, deve verificar o token de autenticação do utilizador (req.headers.authorization)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Se o Admin não iniciou (falta de chaves), retorna erro explicativo
    if (!admin.apps.length) {
        return res.status(500).json({ 
            error: 'Configuração de Servidor Incompleta', 
            details: 'Adicione FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL e FIREBASE_PROJECT_ID nas variáveis de ambiente da Vercel.' 
        });
    }

    try {
        const { title, body, image, target, specificUserId } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
        }

        const db = admin.firestore();
        let tokens: string[] = [];

        // 2. Recolher Tokens (Lógica Robusta Multi-Device)
        if (target === 'specific' && specificUserId) {
            // Enviar para um utilizador específico (todos os seus dispositivos)
            const userDoc = await db.collection('users').doc(specificUserId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData?.deviceTokens && Array.isArray(userData.deviceTokens)) {
                    tokens = userData.deviceTokens;
                } else if (userData?.fcmToken) {
                    // Fallback para sistema antigo
                    tokens = [userData.fcmToken];
                }
            }
        } else {
            // Enviar para TODOS (Marketing)
            // Lógica: Vai buscar todos os utilizadores que têm tokens
            // Nota: Em escala massiva, isto deve ser feito em batches ou tópicos.
            const usersSnap = await db.collection('users').get();
            
            usersSnap.forEach(doc => {
                const userData = doc.data();
                // Adiciona a lista de tokens deste user
                if (userData.deviceTokens && Array.isArray(userData.deviceTokens)) {
                    tokens.push(...userData.deviceTokens);
                } 
                // Suporte legacy
                else if (userData.fcmToken) {
                    tokens.push(userData.fcmToken);
                }
            });
        }

        // Remover duplicados e tokens inválidos
        tokens = [...new Set(tokens)].filter(t => t && t.length > 10);

        if (tokens.length === 0) {
            return res.status(200).json({ success: false, message: 'Nenhum dispositivo registado para envio.' });
        }

        // 3. Enviar Mensagens (Multicast)
        // O Firebase envia para até 500 tokens de cada vez automaticamente com este método
        const messagePayload = {
            notification: {
                title: title,
                body: body,
                ...(image && { imageUrl: image })
            },
            tokens: tokens,
            webpush: {
                fcmOptions: {
                    link: 'https://www.all-shop.net' // Abre a loja ao clicar
                }
            }
        };

        const response = await admin.messaging().sendEachForMulticast(messagePayload);

        // 4. Limpeza de Tokens Inválidos (Manutenção Automática)
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.log(`Falha no envio para ${failedTokens.length} tokens. (Provavelmente inativos)`);
            // Aqui poderíamos remover estes tokens da base de dados futuramente
        }

        return res.status(200).json({ 
            success: true, 
            sentCount: response.successCount, 
            failureCount: response.failureCount,
            totalTargets: tokens.length
        });

    } catch (error: any) {
        console.error('Erro na API de Push:', error);
        return res.status(500).json({ error: error.message || 'Erro interno ao enviar notificação.' });
    }
}
