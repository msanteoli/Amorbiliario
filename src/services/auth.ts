import pb from '@/lib/pocketbase/client'

/**
 * Confirma a redefinição de senha com o token recebido no link de convite ou de recuperação
 */
export async function confirmPasswordReset(
  token: string,
  password: string,
  passwordConfirm: string,
): Promise<boolean> {
  return await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
}

/**
 * Solicita o envio de e-mail de recuperação de senha
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
  return await pb.collection('users').requestPasswordReset(email)
}
