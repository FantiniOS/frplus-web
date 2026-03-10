'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getProspects() {
    try {
        const prospects = await prisma.prospect.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        })
        return prospects
    } catch (error) {
        console.error('Error fetching prospects:', error)
        throw new Error('Erro ao buscar prospects')
    }
}

export async function getLembretesProspeccao() {
    try {
        const hoje = new Date()
        // zera a hora para pegar tudo do dia
        hoje.setHours(23, 59, 59, 999)

        const lembretes = await prisma.prospect.findMany({
            where: {
                dataProximoContato: {
                    lte: hoje
                },
                status: 'ATIVO'
            },
            orderBy: {
                dataProximoContato: 'asc'
            }
        })
        return lembretes
    } catch (error) {
        console.error('Error fetching prospect reminders:', error)
        throw new Error('Erro ao buscar lembretes de prospecção')
    }
}

export async function createProspect(data: {
    nomeEmpresa: string
    nomeContato: string
    telefone: string
    observacoes?: string
    dataUltimoContato?: Date | null
    dataProximoContato?: Date | null
}) {
    try {
        const prospect = await prisma.prospect.create({
            data: {
                nomeEmpresa: data.nomeEmpresa,
                nomeContato: data.nomeContato,
                telefone: data.telefone,
                observacoes: data.observacoes,
                dataUltimoContato: data.dataUltimoContato,
                dataProximoContato: data.dataProximoContato,
            }
        })
        
        revalidatePath('/dashboard/prospects')
        revalidatePath('/dashboard')
        return { success: true, prospect }
    } catch (error) {
        console.error('Error creating prospect:', error)
        return { success: false, error: 'Erro ao criar prospect' }
    }
}

export async function updateProspect(id: string, data: {
    nomeEmpresa?: string
    nomeContato?: string
    telefone?: string
    observacoes?: string
    dataUltimoContato?: Date | null
    dataProximoContato?: Date | null
    status?: string
}) {
    try {
        const prospect = await prisma.prospect.update({
            where: { id },
            data
        })
        
        revalidatePath('/dashboard/prospects')
        revalidatePath('/dashboard')
        return { success: true, prospect }
    } catch (error) {
        console.error('Error updating prospect:', error)
        return { success: false, error: 'Erro ao atualizar prospect' }
    }
}

export async function deleteProspect(id: string) {
    try {
        await prisma.prospect.delete({
            where: { id }
        })
        
        revalidatePath('/dashboard/prospects')
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error('Error deleting prospect:', error)
        return { success: false, error: 'Erro ao deletar prospect' }
    }
}
