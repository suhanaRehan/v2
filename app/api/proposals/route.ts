import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Server-only client using the service role key, so it can insert into
// project_proposals even though that table has no public RLS policies.
// Created lazily (inside the request handler, not at module load) —
// creating it at import time makes Next.js's build-time page data
// collection crash with "supabaseUrl is required" whenever the env vars
// aren't visible during the build step, even if they're set correctly
// for the deployed runtime.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured on the server.')
  }
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, company, phone, service, budgetRange, timeline, description } = body

    if (!name || !email || !phone || !description) {
      return NextResponse.json({ error: 'Name, email, phone, and project description are required.' }, { status: 400 })
    }

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (configErr) {
      console.error('Proposals API configuration error:', configErr)
      return NextResponse.json({ error: 'Server is not configured to accept submissions right now.' }, { status: 500 })
    }

    const { error: dbError } = await supabaseAdmin
      .from('project_proposals')
      .insert({
        name,
        email,
        company: company || null,
        phone: phone || null,
        service: service || null,
        budget_range: budgetRange || null,
        timeline: timeline || null,
        description,
      })

    if (dbError) {
      console.error('Failed to save project proposal:', dbError)
      return NextResponse.json({ error: 'Failed to save your proposal. Please try again.' }, { status: 500 })
    }

    // Optional email notification (only runs if RESEND_API_KEY and CONTACT_NOTIFY_EMAIL are set)
    const resendApiKey = process.env.RESEND_API_KEY
    const notifyEmail = process.env.CONTACT_NOTIFY_EMAIL

    if (resendApiKey && notifyEmail) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Proposals <onboarding@resend.dev>',
            to: notifyEmail,
            subject: `New project proposal from ${name}`,
            text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || '-'}\nPhone: ${phone || '-'}\nService: ${service || '-'}\nBudget: ${budgetRange || '-'}\nTimeline: ${timeline || '-'}\n\nDescription:\n${description}`,
          }),
        })

        if (!emailRes.ok) {
          console.error('Resend email failed:', await emailRes.text())
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr)
      }
    } else {
      console.warn('RESEND_API_KEY or CONTACT_NOTIFY_EMAIL not set — skipping email notification.')
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Proposals API error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
