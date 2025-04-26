use anchor_lang::prelude::Account;

use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub amm_account: Account<'info, AmmAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let amm_account = &mut ctx.accounts.amm_account;

    // Transfer tokens from user to pool
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.pool_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update AMM state
    amm_account.total_deposits = amm_account
        .total_deposits
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Overflow occurred during calculation.")]
    Overflow,
}
