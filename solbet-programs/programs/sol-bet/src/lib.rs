use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("2svSNLozh81SxTnHeaXEDoLMU78kCAvzDg83dvdtMzsY");

#[program]
mod betting {
    use super::*;

    pub fn propose_bet(ctx: Context<ProposeBet>, amount: u64) -> Result<()> {
        require!(ctx.accounts.proposer_token_account.amount >= amount, BettingError::InsufficientFunds);
        transfer_tokens(
            &ctx.accounts.token_program, 
            &ctx.accounts.proposer_token_account, 
            &ctx.accounts.bet_token_account, 
            &ctx.accounts.proposer, 
            amount
        )?;
        setup_bet(
            &mut ctx.accounts.bet, 
            amount, 
            ctx.accounts.proposer.key(), 
            ctx.accounts.proposer_token_account.key(), 
            ctx.accounts.bet_token_account.key()
        );
        Ok(())
    }

    pub fn cancel_bet(ctx: Context<CancelBet>) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Open, BettingError::BetNotAccepted);
        require!(ctx.accounts.bet.proposer == *ctx.accounts.proposer.key, BettingError::Unauthorized);
        transfer_tokens(
            &ctx.accounts.token_program, 
            &ctx.accounts.bet_token_account, 
            &ctx.accounts.proposer_token_account, 
            &ctx.accounts.proposer, 
            ctx.accounts.bet_token_account.amount
        )?;
        ctx.accounts.bet.status = BetStatus::Canceled;
        Ok(())
    }

    pub fn accept_bet(ctx: Context<AcceptBet>, amount: u64) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Open && ctx.accounts.bet.amount == amount, BettingError::BetAlreadyAccepted);
        require!(ctx.accounts.acceptor_token_account.amount >= amount, BettingError::InsufficientFunds);
        transfer_tokens(
            &ctx.accounts.token_program, 
            &ctx.accounts.acceptor_token_account, 
            &ctx.accounts.bet_token_account, 
            &ctx.accounts.acceptor, 
            amount
        )?;
        ctx.accounts.bet.acceptor = ctx.accounts.acceptor.key();
        ctx.accounts.bet.acceptor_token_account = ctx.accounts.acceptor_token_account.key();
        ctx.accounts.bet.status = BetStatus::Accepted;
        Ok(())
    }

    pub fn resolve_bet(ctx: Context<ResolveBet>, winner: Pubkey) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Accepted, BettingError::BetNotAccepted);
        ctx.accounts.bet.winner = winner;
        ctx.accounts.bet.status = BetStatus::Resolved;
        Ok(())
    }

    pub fn nullify_bet(ctx: Context<ResolveBet>) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Accepted, BettingError::BetNotAccepted);
        ctx.accounts.bet.status = BetStatus::Nullified;
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        require!(ctx.accounts.bet.status == BetStatus::Resolved && *ctx.accounts.claimant.key == ctx.accounts.bet.winner, BettingError::NotTheWinner);
        transfer_tokens(
            &ctx.accounts.token_program, 
            &ctx.accounts.bet_token_account, 
            &ctx.accounts.claimant_token_account, 
            &ctx.accounts.admin, 
            ctx.accounts.bet_token_account.amount
        )?;
        ctx.accounts.bet.status = BetStatus::Closed;
        Ok(())
    }

    //pub fn retrieve_bet when bet nullified
}

fn transfer_tokens<'info>(
    token_program: &AccountInfo<'info>,
    from_account: &Account<'info, TokenAccount>,
    to_account: &Account<'info, TokenAccount>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: from_account.to_account_info(),
        to: to_account.to_account_info(),
        authority: authority.to_account_info(),
    };
    let cpi_program = token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

fn setup_bet(bet: &mut Account<Bet>, amount: u64, proposer: Pubkey, proposer_token_account: Pubkey, bet_token_account: Pubkey) {
    bet.amount = amount;
    bet.proposer = proposer;
    bet.acceptor = Pubkey::default();
    bet.winner = Pubkey::default();
    bet.proposer_token_account = proposer_token_account;
    bet.acceptor_token_account = Pubkey::default();
    bet.bet_token_account = bet_token_account;
    bet.status = BetStatus::Open;
}

#[derive(Accounts)]
pub struct ProposeBet<'info> {
    #[account(init, payer = proposer, space = 8 + 128)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub proposer_token_account: Account<'info, TokenAccount>,
    #[account(init, payer = proposer, space = 8 + 165, seeds = [b"bet_token_account", bet.key().as_ref()], bump)]
    pub bet_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub proposer_token_account: Account<'info, TokenAccount>,
    pub bet_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AcceptBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub acceptor: Signer<'info>,
    #[account(mut)]
    pub acceptor_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub bet_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, Bet>,
    pub admin: Signer<'info>,
}

//pub struct NullifyBet<'info>

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(mut)]
    pub claimant_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub bet_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Bet {
    pub amount: u64,

    pub proposer: Pubkey,
    pub acceptor: Pubkey,
    pub winner: Pubkey,

    pub proposer_token_account: Pubkey,
    pub acceptor_token_account: Pubkey,
    pub bet_token_account: Pubkey,
    //pub token_mint: x,
    
    pub status: BetStatus,
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
    Unauthorized
}
