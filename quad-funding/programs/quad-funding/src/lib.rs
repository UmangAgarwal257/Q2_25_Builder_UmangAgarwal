mod instructions;
mod state;

use anchor_lang::prelude::*;

declare_id!("9XRGiEsctsuc7pwZK3hoRY4uQfZPyYbKMCHrSmMvNEMk");

#[program]
pub mod quad_funding {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
