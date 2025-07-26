# SickSquares Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your repository should be on GitHub
3. **Vercel Postgres Database**: Set up through Vercel dashboard

## 1. Database Setup

1. Go to your Vercel dashboard
2. Create a new Postgres database or use existing one
3. Copy the `POSTGRES_URL` connection string
4. The database tables will be created automatically on first API call

## 2. GitHub OAuth Setup

### Create Production OAuth App

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/applications/new)
2. Fill in the details:
   - **Application name**: SickSquares Production
   - **Homepage URL**: `https://your-domain.vercel.app`
   - **Authorization callback URL**: `https://your-domain.vercel.app/api/auth/callback/github`
3. Save the `Client ID` and `Client Secret`

### Update Development OAuth App (Optional)

If you want to keep development separate:
1. Update your existing OAuth app's callback URL to: `http://localhost:3000/api/auth/callback/github`
2. Or create a separate development OAuth app

## 3. Environment Variables

In your Vercel project settings, add these environment variables:

```bash
NEXTAUTH_URL=https://your-actual-domain.vercel.app
NEXTAUTH_SECRET=your-generated-secret-here
GITHUB_CLIENT_ID=your-production-github-client-id
GITHUB_CLIENT_SECRET=your-production-github-client-secret
POSTGRES_URL=your-vercel-postgres-connection-string
```

### Generate NEXTAUTH_SECRET

Run this command locally:
```bash
openssl rand -base64 32
```

## 4. Deploy to Vercel

### Option 1: GitHub Integration (Recommended)

1. Connect your Vercel account to GitHub
2. Import your repository
3. Set environment variables in project settings
4. Deploy automatically on every push to main

### Option 2: Manual Deploy

```bash
npm install -g vercel
vercel login
vercel
```

## 5. Post-Deployment Checklist

- [ ] Database tables created successfully (test by signing in)
- [ ] GitHub OAuth working (test login/logout)
- [ ] Grid data saving and loading properly
- [ ] Stats displaying correctly
- [ ] Responsive design working on mobile
- [ ] No console errors in browser

## 6. Domain Setup (Optional)

1. In Vercel dashboard, go to your project settings
2. Add your custom domain
3. Update `NEXTAUTH_URL` to your custom domain
4. Update GitHub OAuth app URLs to your custom domain

## 7. Monitoring

Monitor your application:
- Check Vercel function logs for errors
- Monitor database connection pool usage
- Watch for rate limiting issues

## Troubleshooting

### Common Issues

1. **OAuth callback mismatch**: Ensure callback URLs match exactly
2. **Database connection**: Check `POSTGRES_URL` format and permissions
3. **Environment variables**: Ensure all required variables are set in Vercel
4. **CORS issues**: Should be resolved with proper `NEXTAUTH_URL`

### Debug Steps

1. Check Vercel function logs
2. Verify environment variables are set
3. Test OAuth flow step by step
4. Check database connectivity

## Security Notes

- Never commit `.env.local` to git
- Use different OAuth apps for development/production
- Monitor rate limiting and adjust as needed
- Database connections are automatically pooled