use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

pub use instructions::*;

declare_id!("HyrodCdYTKX4TFPpDpuH8pDVb2cKmzkn824btBf1DmvY");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        seed: u64,
        deposit: u64,
        receive: u64,
    ) -> Result<()> {
        ctx.accounts.deposit()
    }
}

#[derive(Accounts)]
pub struct Initialize {}
