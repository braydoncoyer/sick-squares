import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getUserGridData, updateGridSquare, ensureUser } from '@/lib/database'

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

    const gridData = await getUserGridData(session.user.email, year)
    
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