#![allow(unexpected_cfgs)]
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4tymRt4zeN4fpggEY27P9FeyScPBCmfDez49nFVQ8DbE");

#[program]
pub mod nft_staking {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("Program initialized successfully");
        Ok(())
    }

    #[derive(Accounts)]
    pub struct Initialize<'info> {
        #[account(mut)]
        pub payer: Signer<'info>,
        #[account(
            init,
            payer = payer,
            space = 8 + 8, // Adjust space as needed
        )]
        pub state: Account<'info, State>,
        pub system_program: Program<'info, System>,
    }

    #[account]
    pub struct State {
        pub data: u64, // Example field, adjust as needed
    }
}
