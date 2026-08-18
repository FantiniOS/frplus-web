'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'
import { revalidatePath } from 'next/cache'

export interface PerfilEmpresaData {
    nomeEmpresa: string;
    email: string;
    telefone: string;
    campanhaAlcool10OffAtiva: boolean;
}

export async function getPerfilEmpresa(): Promise<PerfilEmpresaData> {
    try {
        let perfil = await prisma.perfilEmpresa.findUnique({
            where: { id: 'fixo' }
        });

        if (!perfil) {
            perfil = await prisma.perfilEmpresa.create({
                data: {
                    id: 'fixo',
                    nomeEmpresa: 'Fantini Representações',
                    email: 'fantinirepresentacoes@gmail.com',
                    telefone: '(31) 99694-4540'
                }
            });
        }

        return {
            nomeEmpresa: perfil.nomeEmpresa,
            email: perfil.email,
            telefone: perfil.telefone,
            campanhaAlcool10OffAtiva: perfil.campanhaAlcool10OffAtiva
        };
    } catch (error) {
        console.error('[PerfilEmpresa] Erro ao buscar:', error);
        return {
            nomeEmpresa: 'Fantini Representações',
            email: '',
            telefone: '',
            campanhaAlcool10OffAtiva: false
        };
    }
}

export async function savePerfilEmpresa(data: PerfilEmpresaData): Promise<{ sucesso: boolean; mensagem?: string }> {
    const user = await getServerUser();
    if (!user || user.role !== 'admin') {
        return { sucesso: false, mensagem: 'Não autorizado.' };
    }

    try {
        await prisma.perfilEmpresa.upsert({
            where: { id: 'fixo' },
            create: {
                id: 'fixo',
                nomeEmpresa: data.nomeEmpresa,
                email: data.email,
                telefone: data.telefone,
                campanhaAlcool10OffAtiva: data.campanhaAlcool10OffAtiva
            },
            update: {
                nomeEmpresa: data.nomeEmpresa,
                email: data.email,
                telefone: data.telefone,
                campanhaAlcool10OffAtiva: data.campanhaAlcool10OffAtiva
            }
        });

        revalidatePath('/', 'layout');
        return { sucesso: true };
    } catch (error) {
        console.error('[PerfilEmpresa] Erro ao salvar:', error);
        return { sucesso: false, mensagem: 'Erro interno ao salvar os dados.' };
    }
}
