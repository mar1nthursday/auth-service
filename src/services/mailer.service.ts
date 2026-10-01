export function sendPasswordResetEmail(email: string, resetUrl: string): void {
  console.log(`[mailer] Password reset link for ${email}: ${resetUrl}`);
}
