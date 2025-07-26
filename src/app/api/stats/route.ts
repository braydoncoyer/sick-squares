import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getUserStats, ensureUser } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // Ensure user exists in database
    await ensureUser({
      id: session.user.email,
      email: session.user.email,
      name: session.user.name || undefined,
      image: session.user.image || undefined
    })

    const stats = await getUserStats(session.user.email, year)
    
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}