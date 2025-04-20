use crate::StakeConfig;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + StakeConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, StakeConfig>,

    pub reward_mint: Account<'info, Mint>,
}
