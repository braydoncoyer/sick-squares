import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getUserGridData, getUserGridDataByDateRange, updateGridSquare, ensureUser } from '@/lib/database'

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

    const { date, intensity } = await request.json()

    // Validate intensity
    if (intensity < 0 || intensity > 4) {
      return NextResponse.json({ error: 'Invalid intensity value' }, { status: 400 })
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