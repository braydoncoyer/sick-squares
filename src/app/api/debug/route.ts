import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Pool } from 'pg'

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

export async function GET(request: NextRequest) {
  const client = await pool.connect()
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user exists
    const userResult = await client.query(
      'SELECT * FROM users WHERE email = $1 OR id = $1',
      [session.user.email]
    )

    // Check user's grid data
    const gridResult = await client.query(
      'SELECT * FROM user_grids WHERE user_id = $1 ORDER BY date DESC LIMIT 10',
      [session.user.email]
    )

    // Count total entries
    const countResult = await client.query(
      'SELECT COUNT(*) as total FROM user_grids WHERE user_id = $1',
      [session.user.email]
    )

    return NextResponse.json({ 
      session: {
        email: session.user.email,
        name: session.user.name
      },
      user: userResult.rows[0] || null,
      recentGridData: gridResult.rows,
      totalEntries: countResult.rows[0]?.total || 0
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ 
      error: 'Database error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    client.release()
  }
}