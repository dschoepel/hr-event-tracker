// Edge-compatible auth config — no DB adapter, used by middleware
import Google from 'next-auth/providers/google'

export const authConfig = {
  pages: {
    signIn: '/auth/signin',
  },
  providers: [Google],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const publicPaths = ['/', '/auth']
      const isPublic = publicPaths.some(p => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + '/'))
      if (isPublic) return true
      return isLoggedIn
    },
  },
}
