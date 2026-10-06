export function getRoleLabel(role?: string): string {
  switch (role) {
    case 'admin':
      return 'Administrador'
    case 'sdr':
      return 'SDR'
    case 'corretor':
      return 'Corretor'
    default:
      return role || 'Usuário'
  }
}

export function isAllowedRole(role?: string): boolean {
  return role === 'admin' || role === 'sdr' || role === 'corretor'
}
