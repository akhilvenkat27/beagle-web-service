/** Default landing path after login — one primary workspace per role. */
export function getHomePathForRole(role) {
  switch (role) {
    case 'client':
      return '/client/dashboard';
    case 'member':
      return '/member/dashboard';
    case 'pm':
      return '/dashboard/pm';
    case 'dh':
      return '/dashboard/dh';
    case 'pmo':
    case 'admin':
      return '/dashboard/pmo';
    case 'exec':
      return '/dashboard/exec';
    default:
      return '/home';
  }
}
