use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use anchor_spl::token_interface::{self, InitializeAccount};
use std::mem::size_of;


declare_id!("7FXV44gNT2FmyaNGadhA7SnKUXJEbMAAfH24o3QApTE8");

#[program]
mod betting {
    use std::str::FromStr;

    use super::*;

    pub fn propose_bet(ctx: Context<ProposeBet>, amount: u64) -> Result<()> {
        require!(ctx.accounts.proposer_token_account.amount >= amount, BettingError::InsufficientFunds);
        require!(amount > 0, BettingError::InvalidAmount);

        let cpi_accounts = InitializeAccount {
            account: ctx.accounts.bet_token_account.to_account_info(),
            mint: ctx.accounts.spl_mint_account.to_account_info(), 
            authority: ctx.accounts.bet.to_account_info(), 
            rent: ctx.accounts.rent.to_account_info(), 
        };
    
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token_interface::initialize_account(cpi_ctx)?;

        let cpi_accounts = Transfer {
            from: ctx.accounts.proposer_token_account.to_account_info(),
            to: ctx.accounts.bet_token_account.to_account_info(),
            authority: ctx.accounts.proposer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer(cpi_ctx, amount)?;

        ctx.accounts.bet.amount = amount;
        ctx.accounts.bet.proposer = ctx.accounts.proposer.key();
        ctx.accounts.bet.acceptor = Pubkey::default();
        ctx.accounts.bet.winner = Pubkey::default();
        ctx.accounts.bet.status = BetStatus::Open;
        ctx.accounts.bet.bump = ctx.bumps.bet;

        Ok(())
    }

    pub fn cancel_bet(ctx: Context<CancelBet>, id: u64) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Open, BettingError::BetNotAccepted);
        require!(ctx.accounts.bet.proposer == *ctx.accounts.proposer.key, BettingError::Unauthorized);

        let id_bytes = id.to_le_bytes();
        let seeds = &[b"bets-from-id", id_bytes.as_ref(), &[ctx.accounts.bet.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.bet_token_account.to_account_info(),
            to: ctx.accounts.proposer_token_account.to_account_info(),
            authority: ctx.accounts.bet.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, ctx.accounts.bet.amount)?;

        ctx.accounts.bet.status = BetStatus::Canceled;

        Ok(())
    }

    pub fn accept_bet(ctx: Context<AcceptBet>, amount: u64) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Open && ctx.accounts.bet.amount == amount, BettingError::BetAlreadyAccepted);
        require!(ctx.accounts.acceptor_token_account.amount >= amount, BettingError::InsufficientFunds);

        let cpi_accounts = Transfer {
            from: ctx.accounts.acceptor_token_account.to_account_info(),
            to: ctx.accounts.bet_token_account.to_account_info(),
            authority: ctx.accounts.acceptor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer(cpi_ctx, amount)?;

        ctx.accounts.bet.acceptor = ctx.accounts.acceptor.key();
        ctx.accounts.bet.status = BetStatus::Accepted;

        Ok(())
    }

    pub fn resolve_bet(ctx: Context<ResolveBet>, winner: Pubkey) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Accepted, BettingError::BetNotAccepted);
        require!(ctx.accounts.admin.is_signer, BettingError::NotSignedByAdmin);
        require!(*ctx.accounts.admin.key == Pubkey::from_str("2ax3geQJHsm8hkJAJbcJ29b2uWckB1XX6R6CmmBi8rrP").unwrap(), BettingError::NotSignedByAdmin);
        ctx.accounts.bet.winner = winner;
        ctx.accounts.bet.status = BetStatus::Resolved;
        Ok(())
    }

    pub fn nullify_bet(ctx: Context<ResolveBet>) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Accepted, BettingError::BetNotAccepted);
        ctx.accounts.bet.status = BetStatus::Nullified;
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>, id: u64) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Resolved && *ctx.accounts.claimant.key == ctx.accounts.bet.winner, BettingError::NotTheWinner);

        let id_bytes = id.to_le_bytes();
        let seeds = &[b"bets-from-id", id_bytes.as_ref(), &[ctx.accounts.bet.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.bet_token_account.to_account_info(),
            to: ctx.accounts.claimant_token_account.to_account_info(),
            authority: ctx.accounts.bet.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, ctx.accounts.bet.amount*2)?;

        ctx.accounts.bet.status = BetStatus::Closed;
        Ok(())
    }
}


#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ProposeBet<'info> {
    #[account(init, payer = proposer, space = size_of::<Bet>(), seeds = [b"bets-from-id", id.to_le_bytes().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub proposer_token_account: Account<'info, TokenAccount>,
    #[account(init, payer = proposer, space = size_of::<TokenAccount>(), seeds = [b"bets-token-id", id.to_le_bytes().as_ref()], bump)]
    pub bet_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub spl_mint_account: Account<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CancelBet<'info> {
    #[account(mut, seeds = [b"bets-from-id", id.to_le_bytes().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    pub proposer: Signer<'info>,
    pub proposer_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"bets-token-id", id.to_le_bytes().as_ref()], bump)]
    pub bet_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct AcceptBet<'info> {
    #[account(mut, seeds = [b"bets-from-id", id.to_le_bytes().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    pub acceptor: Signer<'info>,
    pub acceptor_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"bets-token-id", id.to_le_bytes().as_ref()], bump)]
    pub bet_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ResolveBet<'info> {
    #[account(mut, seeds = [b"bets-from-id", id.to_le_bytes().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    #[account(signer)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ClaimWinnings<'info> {
    #[account(mut, seeds = [b"bets-from-id", id.to_le_bytes().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    pub claimant: Signer<'info>,
    pub claimant_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"bets-token-id", id.to_le_bytes().as_ref()], bump)]
    pub bet_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Bet {
    pub amount: u64,

    pub proposer: Pubkey,
    pub acceptor: Pubkey,
    pub winner: Pubkey,

    pub status: BetStatus,

    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BetStatus {
    Open,
    Canceled,
    Accepted,
    Resolved,
    Nullified,
    Closed,
}

#[error_code]
pub enum BettingError {
    BetAlreadyAccepted,
    BetNotAccepted,
    BetNotResolved,
    NotTheWinner,
    InsufficientFunds,
    InvalidAmount,
    Unauthorized,
    NotSignedByAdmin
}
