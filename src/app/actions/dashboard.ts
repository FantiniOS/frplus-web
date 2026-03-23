'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

export type ChartViewMode = 'Mensal' | 'Anual' | 'Global'

export interface ChartDataResponse {
    date: string
    dayLabel: string
    value: number
}

// Helper to get days in a month
const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
}

export async function getDashboardChartData(
    view: ChartViewMode,
    yearStr?: number | null,
    monthStr?: number | null
): Promise<ChartDataResponse[]> {
    const user = await getServerUser()
    if (!user) {
        throw new Error('Não autorizado')
    }

    const whereClause: any = {
        status: { notIn: ['Cancelado'] }
    }

    if (user.role === 'industria' && user.fabricaId) {
        whereClause.fabricaId = user.fabricaId
    }

    const now = new Date()

    if (view === 'Mensal') {
        const year = yearStr || now.getFullYear()
        const month = monthStr !== null && monthStr !== undefined ? monthStr : now.getMonth()
        
        const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0))
        const endDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0))
        
        whereClause.data = {
            gte: startDate,
            lt: endDate
        }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true }
        })

        const days = getDaysInMonth(year, month)
        const dailyMap = new Map<number, number>()
        
        orders.forEach(o => {
            const day = o.data.getUTCDate()
            dailyMap.set(day, (dailyMap.get(day) || 0) + Number(o.valorTotal))
        })

        const result: ChartDataResponse[] = []
        for (let day = 1; day <= days; day++) {
            result.push({
                date: new Date(Date.UTC(year, month, day)).toISOString(),
                dayLabel: String(day),
                value: dailyMap.get(day) || 0
            })
        }
        return result
    }
    
    if (view === 'Anual') {
        const year = yearStr || now.getFullYear()
        const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
        const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))
        
        whereClause.data = {
            gte: startDate,
            lt: endDate
        }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true }
        })

        const monthlyMap = new Map<number, number>()
        orders.forEach(o => {
            const m = o.data.getUTCMonth()
            monthlyMap.set(m, (monthlyMap.get(m) || 0) + Number(o.valorTotal))
        })

        const monthsStr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        const result: ChartDataResponse[] = []
        for (let m = 0; m < 12; m++) {
            result.push({
                date: new Date(Date.UTC(year, m, 1)).toISOString(),
                dayLabel: monthsStr[m],
                value: monthlyMap.get(m) || 0
            })
        }
        return result
    }

    if (view === 'Global') {
        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true },
            orderBy: { data: 'asc' }
        })

        const yearlyMap = new Map<number, number>()
        let minYear = now.getFullYear()
        let maxYear = minYear

        orders.forEach(o => {
            const y = o.data.getUTCFullYear()
            if (y < minYear) minYear = y
            if (y > maxYear) maxYear = y
            yearlyMap.set(y, (yearlyMap.get(y) || 0) + Number(o.valorTotal))
        })

        const result: ChartDataResponse[] = []
        for (let y = minYear; y <= maxYear; y++) {
            result.push({
                date: new Date(Date.UTC(y, 0, 1)).toISOString(),
                dayLabel: String(y),
                value: yearlyMap.get(y) || 0
            })
        }
        
        return result
    }

    return []
}
