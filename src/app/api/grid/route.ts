import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getUserGridData, getUserGridDataByDateRange, updateGridSquare, ensureUser } from '@/lib/database'
import { rateLimit } from '@/lib/ratelimit'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const year = searchParams.get('year')

    // Ensure user exists in database
    await ensureUser({
      id: session.user.email,
      email: session.user.email,
      name: session.user.name || undefined,
      image: session.user.image || undefined
    })

    let gridData
    if (startDate && endDate) {
      // Use date range query for rolling 12 months
      gridData = await getUserGridDataByDateRange(session.user.email, startDate, endDate)
    } else if (year) {
      // Use year query for backward compatibility
      gridData = await getUserGridData(session.user.email, parseInt(year))
    } else {
      return NextResponse.json({ error: 'Either year or date range (startDate and endDate) is required' }, { status: 400 })
    }
    
    return NextResponse.json({ gridData })
  } catch (error) {
    console.error('Error fetching grid data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting: 30 updates per minute per user
    if (!rateLimit(session.user.email, 30, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { date, intensity } = body

    // Validate required fields
    if (!date || intensity === undefined) {
      return NextResponse.json({ error: 'Date and intensity are required' }, { status: 400 })
    }

    // Validate intensity
    if (typeof intensity !== 'number' || intensity < 0 || intensity > 4) {
      return NextResponse.json({ error: 'Intensity must be a number between 0 and 4' }, { status: 400 })
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({ error: 'Date must be in YYYY-MM-DD format' }, { status: 400 })
    }

    // Prevent future dates
    const dateObj = new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    if (dateObj > today) {
      return NextResponse.json({ error: 'Cannot modify future dates' }, { status: 400 })
    }

    // Ensure user exists in database
    await ensureUser({
      id: session.user.email,
      email: session.user.email,
      name: session.user.name || undefined,
      image: session.user.image || undefined
    })

    const updatedSquare = await updateGridSquare(session.user.email, date, intensity)
    
    return NextResponse.json({ square: updatedSquare })
  } catch (error) {
    console.error('Error updating grid square:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}