import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserStats, getUserStatsByDateRange, ensureUser } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const year = searchParams.get('year')

    const userId = session.user.id || session.user.email

    // Ensure user exists in database
    await ensureUser({
      id: userId,
      email: session.user.email,
      name: session.user.name || undefined,
      image: session.user.image || undefined
    })

    let stats
    if (startDate && endDate) {
      // Use date range query for rolling 12 months
      stats = await getUserStatsByDateRange(userId, startDate, endDate)
    } else if (year) {
      // Use year query for backward compatibility
      stats = await getUserStats(userId, parseInt(year))
    } else {
      return NextResponse.json({ error: 'Either year or date range (startDate and endDate) is required' }, { status: 400 })
    }
    
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}