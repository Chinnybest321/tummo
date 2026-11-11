//! Tummo: a memecoin that is alive.
//!
//! One shared pet. Holders buy $TUMMO and feed it by burning it. Feeding pushes
//! its time of death forward. While it lives, the treasury drips NEAR to the
//! people who fed it. The bigger it grows, the hungrier it gets. If nobody
//! feeds it in time, it dies, goes to the graveyard, and a new egg hatches
//! with whatever is left in the treasury.

use near_contract_standards::fungible_token::events::{FtBurn, FtMint};
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::{
    FungibleToken, FungibleTokenCore, FungibleTokenResolver,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, LookupSet, Vector};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError, PromiseOrValue,
};

pub const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;
pub const ONE_TUMMO: u128 = 1_000_000_000_000_000_000;

// Price: linear bonding curve on total ever minted. Burning never lowers it.
pub const BASE_PRICE: u128 = ONE_NEAR / 1_000; // 0.001 NEAR per TUMMO
pub const PRICE_STEP: u128 = ONE_NEAR / 10_000_000; // +0.0000001 NEAR per TUMMO minted
pub const MAX_BUY: u64 = 100_000;

// Life
pub const SECONDS_PER_TUMMO: u64 = 600; // 1 TUMMO = 10 minutes for a newborn
pub const MAX_AHEAD: u64 = 72 * 3600; // can't be fed more than 3 days ahead
pub const EGG_LIFE: u64 = 24 * 3600; // a fresh egg dies in a day if ignored
pub const RESCUE_WINDOW: u64 = 6 * 3600; // feeding a starving pet counts double
pub const LEVEL_UNIT: u128 = 250; // level = sqrt(eaten / 250)

// Treasury
pub const DRIP_BPS_PER_DAY: u128 = 300; // 3% of the treasury per day, only while alive
const SCALE: u128 = 1_000_000;
pub const SELL_FEE_BPS: u128 = 1_000; // selling pays a fair share of the treasury minus 10%, which stays for the feeders

// Ritual. A feeder only counts toward the feast if the feed is big enough and
// they have held TUMMO for a while. This makes throwaway accounts cost something.
pub const FEAST_FEEDERS: u32 = 10; // qualifying feeders in one day of its life
pub const FEAST_MIN_FEED: u64 = 25; // TUMMO in a single feed
pub const FEAST_MIN_AGE: u64 = 3600; // seconds since the account's first buy
pub const FEAST_BONUS: u64 = 12 * 3600;

pub const ACTIVITY_CAP: u64 = 100;
pub const TOP_N: usize = 10;
const GAS_FOR_CLAIM_CB: Gas = Gas::from_tgas(10);

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Token,
    Feeders,
    DayFed,
    Graves,
    Activity,
    FirstBuy,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Life {
    pub id: u64,
    pub born_at: u64,
    pub deadline: u64,
    pub eaten: U128,
    pub love_total: U128,
    pub reward_per_love: U128,
    pub last_drip_at: u64,
    pub paid_out: U128,
    pub feeders: u32,
    pub feasts: u32,
    pub rescues: u32,
    pub day: u64,
    pub day_feeders: u32,
    pub feasted_today: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct Feeder {
    pub life: u64,
    pub love: U128,
    pub debt: U128,
    pub earned: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Grave {
    pub id: u64,
    pub born_at: u64,
    pub died_at: u64,
    pub eaten: U128,
    pub level: u32,
    pub feeders: u32,
    pub feasts: u32,
    pub paid_out: U128,
    pub top_feeder: Option<AccountId>,
    pub reward_per_love: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Activity {
    pub seq: u64,
    pub kind: String,
    pub account_id: AccountId,
    pub amount: U128,
    pub life: u64,
    pub ts: u64,
}

#[near(serializers = [json])]
pub struct PetView {
    pub life: Life,
    pub now: u64,
    pub alive: bool,
    pub level: u32,
    pub seconds_per_tummo: u64,
    pub treasury: U128,
    pub drip_per_day: U128,
    pub price: U128,
    pub minted: U128,
    pub supply: U128,
    pub burned: U128,
    pub graves: u64,
    pub top: Vec<(AccountId, U128)>,
}

/// Every rule, readable by anyone. All of them are compile-time constants:
/// there is no method that changes them.
#[near(serializers = [json])]
pub struct Config {
    pub base_price: U128,
    pub price_step: U128,
    pub max_buy: u64,
    pub seconds_per_tummo: u64,
    pub level_unit: U128,
    pub max_ahead: u64,
    pub egg_life: u64,
    pub rescue_window: u64,
    pub rescue_multiplier: u32,
    pub drip_bps_per_day: U128,
    pub feast_feeders: u32,
    pub feast_min_feed: u64,
    pub feast_min_age: u64,
    pub feast_bonus: u64,
    pub sell_fee_bps: U128,
    pub admin: Option<AccountId>,
}

#[near(serializers = [json])]
pub struct FeederView {
    pub love: U128,
    pub claimable: U128,
    pub tummo: U128,
    pub fed_this_life: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    life: Life,
    feeders: LookupMap<AccountId, Feeder>,
    day_fed: LookupSet<String>,
    graves: Vector<Grave>,
    activity: LookupMap<u64, Activity>,
    activity_seq: u64,
    first_buy: LookupMap<AccountId, u64>,
    top: Vec<(AccountId, u128)>,
    treasury: u128,
    minted: u128,
    burned: u128,
}

fn now_s() -> u64 {
    env::block_timestamp_ms() / 1000
}

fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

pub fn level_of(eaten: u128) -> u32 {
    isqrt(eaten / LEVEL_UNIT) as u32
}

/// The bigger it gets, the less life each TUMMO buys.
pub fn seconds_per_tummo(level: u32) -> u64 {
    (SECONDS_PER_TUMMO / (1 + level as u64)).max(10)
}

fn new_life(id: u64, t: u64) -> Life {
    Life {
        id,
        born_at: t,
        deadline: t + EGG_LIFE,
        eaten: U128(0),
        love_total: U128(0),
        reward_per_love: U128(0),
        last_drip_at: t,
        paid_out: U128(0),
        feeders: 0,
        feasts: 0,
        rescues: 0,
        day: 0,
        day_feeders: 0,
        feasted_today: false,
    }
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            token: FungibleToken::new(Key::Token),
            life: new_life(1, now_s()),
            feeders: LookupMap::new(Key::Feeders),
            day_fed: LookupSet::new(Key::DayFed),
            graves: Vector::new(Key::Graves),
            activity: LookupMap::new(Key::Activity),
            activity_seq: 0,
            first_buy: LookupMap::new(Key::FirstBuy),
            top: Vec::new(),
            treasury: 0,
            minted: 0,
            burned: 0,
        }
    }

    // ---------- actions ----------

    /// Buy `count` TUMMO. Every yoctoNEAR paid goes to the treasury. Extra is refunded.
    #[payable]
    pub fn buy(&mut self, count: u64) -> U128 {
        require!(count >= 1 && count <= MAX_BUY, "buy 1-100000 TUMMO");
        self.tick();
        let who = env::predecessor_account_id();
        let cost = self.cost(count);
        let paid = env::attached_deposit().as_yoctonear();
        require!(paid >= cost, format!("need {} yocto", cost));
        self.treasury += cost;
        self.minted += count as u128;
        if !self.token.accounts.contains_key(&who) {
            self.token.internal_register_account(&who);
        }
        if !self.first_buy.contains_key(&who) {
            self.first_buy.insert(who.clone(), now_s());
        }
        let amount = count as u128 * ONE_TUMMO;
        self.token.internal_deposit(&who, amount);
        FtMint { owner_id: &who, amount: U128(amount), memo: Some("buy") }.emit();
        self.record("buy", who.clone(), count as u128);
        if paid > cost {
            Promise::new(who).transfer(NearToken::from_yoctonear(paid - cost)).detach();
        }
        U128(cost)
    }

    /// Feed the pet `count` TUMMO. The TUMMO is burned. Returns the new time of death.
    pub fn feed(&mut self, count: u64) -> u64 {
        require!(count >= 1, "feed at least 1 TUMMO");
        self.tick();
        let who = env::predecessor_account_id();
        let amount = count as u128 * ONE_TUMMO;
        self.token.internal_withdraw(&who, amount);
        self.burned += count as u128;
        FtBurn { owner_id: &who, amount: U128(amount), memo: Some("feed") }.emit();

        let t = now_s();
        let rescue = self.life.deadline.saturating_sub(t) <= RESCUE_WINDOW;
        let love_add = count as u128 * if rescue { 2 } else { 1 };

        let mut f = self.settled(&who);
        if f.love.0 == 0 {
            self.life.feeders += 1;
        }
        f.love = U128(f.love.0 + love_add);
        f.debt = U128(f.love.0 * self.life.reward_per_love.0);
        self.feeders.insert(who.clone(), f.clone());
        self.life.love_total = U128(self.life.love_total.0 + love_add);

        let lvl = level_of(self.life.eaten.0);
        let add = count.saturating_mul(seconds_per_tummo(lvl));
        self.life.eaten = U128(self.life.eaten.0 + count as u128);
        self.life.deadline = (self.life.deadline.saturating_add(add)).min(t + MAX_AHEAD);
        if rescue {
            self.life.rescues += 1;
        }
        self.record(if rescue { "rescue" } else { "feed" }, who.clone(), count as u128);

        // daily ritual: enough different people feed it in one day of its life
        let day = (t - self.life.born_at) / 86_400;
        if day != self.life.day {
            self.life.day = day;
            self.life.day_feeders = 0;
            self.life.feasted_today = false;
        }
        let held = self.first_buy.get(&who).map_or(0, |b| t.saturating_sub(*b));
        if count >= FEAST_MIN_FEED && held >= FEAST_MIN_AGE {
            let key = format!("{}:{}:{}", self.life.id, day, who);
            if self.day_fed.insert(key) {
                self.life.day_feeders += 1;
            }
        }
        if !self.life.feasted_today && self.life.day_feeders >= FEAST_FEEDERS {
            self.life.feasted_today = true;
            self.life.feasts += 1;
            self.life.deadline = (self.life.deadline + FEAST_BONUS).min(t + MAX_AHEAD + FEAST_BONUS);
            self.record("feast", who.clone(), self.life.day_feeders as u128);
        }

        self.bump_top(&who, f.love.0);
        self.life.deadline
    }

    /// Bury a dead pet and hatch the next egg. Anyone can call; buy and feed do it too.
    pub fn bury(&mut self) {
        require!(now_s() >= self.life.deadline, "still alive");
        self.tick();
    }

    /// Withdraw NEAR earned from the drip.
    pub fn claim(&mut self) -> Promise {
        self.tick();
        let who = env::predecessor_account_id();
        let mut f = self.settled(&who);
        let amount = f.earned.0;
        require!(amount > 0, "nothing to claim");
        f.earned = U128(0);
        self.feeders.insert(who.clone(), f);
        Promise::new(who.clone()).transfer(NearToken::from_yoctonear(amount)).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_FOR_CLAIM_CB)
                .on_claim(who, U128(amount)),
        )
    }

    #[private]
    pub fn on_claim(&mut self, account_id: AccountId, amount: U128, #[callback_result] r: Result<(), PromiseError>) {
        if r.is_err() {
            let mut f = self.feeders.get(&account_id).cloned().unwrap_or_default();
            f.earned = U128(f.earned.0 + amount.0);
            self.feeders.insert(account_id, f);
        }
    }

    /// Sell `count` TUMMO back to the treasury. The TUMMO is burned and the seller gets
    /// its share of the treasury (treasury / supply per TUMMO) minus SELL_FEE_BPS.
    /// Paying a share, never a fixed price, means the treasury can't be run dry.
    pub fn sell(&mut self, count: u64) -> Promise {
        require!(count >= 1, "sell at least 1 TUMMO");
        self.tick();
        let who = env::predecessor_account_id();
        let payout = self.sell_value(count);
        require!(payout > 0, "nothing to pay out");
        let amount = count as u128 * ONE_TUMMO;
        self.token.internal_withdraw(&who, amount);
        self.treasury -= payout;
        FtBurn { owner_id: &who, amount: U128(amount), memo: Some("sell") }.emit();
        self.record("sell", who.clone(), count as u128);
        Promise::new(who.clone()).transfer(NearToken::from_yoctonear(payout)).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_FOR_CLAIM_CB)
                .on_sell(who, U128(amount), U128(payout)),
        )
    }

    /// The NEAR couldn't be delivered: give the TUMMO and the NEAR back.
    #[private]
    pub fn on_sell(&mut self, account_id: AccountId, amount: U128, payout: U128, #[callback_result] r: Result<(), PromiseError>) {
        if r.is_err() {
            self.treasury += payout.0;
            self.token.internal_deposit(&account_id, amount.0);
            FtMint { owner_id: &account_id, amount, memo: Some("sell refund") }.emit();
        }
    }

    // ---------- views ----------

    /// yoctoNEAR that selling `count` TUMMO would pay right now (before any pending drip).
    pub fn sell_quote(&self, count: u64) -> U128 {
        U128(self.sell_value(count))
    }

    pub fn get_config(&self) -> Config {
        Config {
            base_price: U128(BASE_PRICE),
            price_step: U128(PRICE_STEP),
            max_buy: MAX_BUY,
            seconds_per_tummo: SECONDS_PER_TUMMO,
            level_unit: U128(LEVEL_UNIT),
            max_ahead: MAX_AHEAD,
            egg_life: EGG_LIFE,
            rescue_window: RESCUE_WINDOW,
            rescue_multiplier: 2,
            drip_bps_per_day: U128(DRIP_BPS_PER_DAY),
            feast_feeders: FEAST_FEEDERS,
            feast_min_feed: FEAST_MIN_FEED,
            feast_min_age: FEAST_MIN_AGE,
            feast_bonus: FEAST_BONUS,
            sell_fee_bps: U128(SELL_FEE_BPS),
            admin: None,
        }
    }

    pub fn quote(&self, count: u64) -> U128 {
        U128(self.cost(count))
    }

    pub fn get_pet(&self) -> PetView {
        let t = now_s();
        let lvl = level_of(self.life.eaten.0);
        PetView {
            life: self.life.clone(),
            now: t,
            alive: t < self.life.deadline,
            level: lvl,
            seconds_per_tummo: seconds_per_tummo(lvl),
            treasury: U128(self.treasury),
            drip_per_day: U128(self.treasury * DRIP_BPS_PER_DAY / 10_000),
            price: U128(self.cost(1)),
            minted: U128(self.minted),
            supply: self.token.ft_total_supply(),
            burned: U128(self.burned),
            graves: self.graves.len() as u64,
            top: self.top.iter().map(|(a, l)| (a.clone(), U128(*l))).collect(),
        }
    }

    pub fn get_feeder(&self, account_id: AccountId) -> FeederView {
        let f = self.feeders.get(&account_id).cloned().unwrap_or_default();
        let (love, claimable) = self.preview(&f);
        FeederView {
            love: U128(love),
            claimable: U128(claimable),
            tummo: self.token.ft_balance_of(account_id),
            fed_this_life: f.life == self.life.id && f.love.0 > 0,
        }
    }

    /// Newest first.
    pub fn get_graves(&self, limit: Option<u32>) -> Vec<Grave> {
        let n = self.graves.len();
        (0..n).rev().take(limit.unwrap_or(20) as usize).filter_map(|i| self.graves.get(i).cloned()).collect()
    }

    /// Newest first. Keeps the last 100.
    pub fn get_activity(&self, limit: Option<u64>) -> Vec<Activity> {
        let n = limit.unwrap_or(40).min(ACTIVITY_CAP);
        let from = self.activity_seq.saturating_sub(n);
        (from..self.activity_seq)
            .rev()
            .filter_map(|i| self.activity.get(&(i % ACTIVITY_CAP)).filter(|a| a.seq == i).cloned())
            .collect()
    }

    // ---------- internals ----------

    fn sell_value(&self, count: u64) -> u128 {
        let supply = self.token.ft_total_supply().0 / ONE_TUMMO;
        if count == 0 || count as u128 > supply {
            return 0;
        }
        // divide first: treasury * count could overflow u128; rounding down favors the treasury
        self.treasury / supply * count as u128 * (10_000 - SELL_FEE_BPS) / 10_000
    }

    fn cost(&self, count: u64) -> u128 {
        let n = count as u128;
        n * BASE_PRICE + PRICE_STEP * (n * self.minted + n * n.saturating_sub(1) / 2)
    }

    /// Drip the treasury up to now (or the moment of death), then bury if dead.
    fn tick(&mut self) {
        let t = now_s();
        let end = t.min(self.life.deadline);
        if end > self.life.last_drip_at {
            let love = self.life.love_total.0;
            if love > 0 {
                let dt = (end - self.life.last_drip_at) as u128;
                let amount = self.treasury * DRIP_BPS_PER_DAY * dt / (10_000 * 86_400);
                if amount > 0 {
                    let per = amount * SCALE / love;
                    let used = per * love / SCALE;
                    self.life.reward_per_love = U128(self.life.reward_per_love.0 + per);
                    self.treasury -= used;
                    self.life.paid_out = U128(self.life.paid_out.0 + used);
                }
            }
            self.life.last_drip_at = end;
        }
        if t >= self.life.deadline {
            self.die(t);
        }
    }

    fn die(&mut self, t: u64) {
        let l = &self.life;
        let grave = Grave {
            id: l.id,
            born_at: l.born_at,
            died_at: l.deadline,
            eaten: l.eaten,
            level: level_of(l.eaten.0),
            feeders: l.feeders,
            feasts: l.feasts,
            paid_out: l.paid_out,
            top_feeder: self.top.first().map(|(a, _)| a.clone()),
            reward_per_love: l.reward_per_love,
        };
        let id = l.id;
        self.graves.push(grave);
        self.record("death", env::current_account_id(), id as u128);
        self.life = new_life(id + 1, t);
        self.top.clear();
    }

    fn rpl_of(&self, life: u64) -> u128 {
        if life == self.life.id {
            self.life.reward_per_love.0
        } else if life >= 1 {
            self.graves.get((life - 1) as u32).map(|g| g.reward_per_love.0).unwrap_or(0)
        } else {
            0
        }
    }

    fn preview(&self, f: &Feeder) -> (u128, u128) {
        let pending = (f.love.0 * self.rpl_of(f.life)).saturating_sub(f.debt.0) / SCALE;
        let love = if f.life == self.life.id { f.love.0 } else { 0 };
        (love, f.earned.0 + pending)
    }

    /// Moves pending drip into `earned` and moves the feeder onto the current life.
    fn settled(&self, who: &AccountId) -> Feeder {
        let mut f = self.feeders.get(who).cloned().unwrap_or_default();
        let pending = (f.love.0 * self.rpl_of(f.life)).saturating_sub(f.debt.0) / SCALE;
        f.earned = U128(f.earned.0 + pending);
        if f.life != self.life.id {
            f.life = self.life.id;
            f.love = U128(0);
        }
        f.debt = U128(f.love.0 * self.life.reward_per_love.0);
        f
    }

    fn bump_top(&mut self, who: &AccountId, love: u128) {
        if let Some(e) = self.top.iter_mut().find(|(a, _)| a == who) {
            e.1 = love;
        } else {
            self.top.push((who.clone(), love));
        }
        self.top.sort_by(|a, b| b.1.cmp(&a.1));
        self.top.truncate(TOP_N);
    }

    fn record(&mut self, kind: &str, account_id: AccountId, amount: u128) {
        let a = Activity { seq: self.activity_seq, kind: kind.into(), account_id, amount: U128(amount), life: self.life.id, ts: now_s() };
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"tummo\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":[{}]}}",
            kind,
            near_sdk::serde_json::to_string(&a).unwrap_or_default()
        ));
        self.activity.insert(self.activity_seq % ACTIVITY_CAP, a);
        self.activity_seq += 1;
    }
}

// ---------- NEP-141 ----------

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }
    #[payable]
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }
    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }
    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned > 0 {
            FtBurn { owner_id: &sender_id, amount: U128(burned), memo: Some("Tokens burned") }.emit();
        }
        used.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }
    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }
    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.internal_storage_unregister(force).is_some()
    }
    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }
    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Tummo".to_string(),
            symbol: "TUMMO".to_string(),
            icon: Some(ICON.to_string()),
            reference: None,
            reference_hash: None,
            decimals: 18,
        }
    }
}

const ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23ffd84d'/%3E%3Cpath d='M14 40c0-14 8-24 18-24s18 10 18 24c0 6-8 9-18 9s-18-3-18-9z' fill='%23fff' stroke='%23161616' stroke-width='3'/%3E%3Ccircle cx='26' cy='34' r='2.6' fill='%23161616'/%3E%3Ccircle cx='38' cy='34' r='2.6' fill='%23161616'/%3E%3Cpath d='M29 40q3 3 6 0' fill='none' stroke='%23161616' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E";

// ---------- tests ----------

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    const SEC: u64 = 1_000_000_000;
    const T0: u64 = 1_000_000;

    fn ctx(who: usize, deposit: u128, t: u64) {
        let mut b = VMContextBuilder::new();
        b.current_account_id("tummo.testnet".parse().unwrap())
            .predecessor_account_id(accounts(who))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(t * SEC);
        testing_env!(b.build());
    }

    fn setup() -> Contract {
        ctx(0, 0, T0);
        Contract::new()
    }

    fn buy(c: &mut Contract, who: usize, n: u64, t: u64) {
        ctx(who, c.quote(n).0, t);
        c.buy(n);
    }

    #[test]
    fn egg_dies_in_a_day() {
        let c = setup();
        assert_eq!(c.life.deadline, T0 + EGG_LIFE);
        assert!(c.get_pet().alive);
    }

    #[test]
    fn buying_mints_and_fills_treasury() {
        let mut c = setup();
        let q = c.quote(10).0;
        assert_eq!(q, 10 * BASE_PRICE + PRICE_STEP * 45);
        buy(&mut c, 1, 10, T0);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 10 * ONE_TUMMO);
        assert_eq!(c.treasury, q);
        assert!(c.quote(1).0 > BASE_PRICE);
    }

    #[test]
    fn selling_pays_a_share_minus_fee() {
        let mut c = setup();
        buy(&mut c, 1, 100, T0);
        buy(&mut c, 2, 100, T0);
        let treasury = c.treasury;
        let q = c.sell_quote(50).0;
        assert_eq!(q, treasury / 200 * 50 * 9 / 10);
        ctx(1, 0, T0);
        c.sell(50);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 50 * ONE_TUMMO);
        assert_eq!(c.ft_total_supply().0, 150 * ONE_TUMMO);
        assert_eq!(c.treasury, treasury - q);
        // the fee stays behind, so the next TUMMO is worth a little more than before
        assert!(c.sell_quote(1).0 > treasury / 200 * 9 / 10);
        // selling everything never pays more than the treasury holds
        assert!(c.sell_quote(150).0 < c.treasury);
    }

    #[test]
    fn failed_sell_refunds() {
        let mut c = setup();
        buy(&mut c, 1, 10, T0);
        let treasury = c.treasury;
        ctx(1, 0, T0);
        let q = c.sell_quote(10).0;
        c.sell(10);
        c.on_sell(accounts(1), U128(10 * ONE_TUMMO), U128(q), Err(PromiseError::Failed));
        assert_eq!(c.treasury, treasury);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 10 * ONE_TUMMO);
    }

    #[test]
    #[should_panic(expected = "The account doesn't have enough balance")]
    fn cant_sell_more_than_held() {
        let mut c = setup();
        buy(&mut c, 1, 10, T0);
        buy(&mut c, 2, 10, T0);
        ctx(1, 0, T0);
        c.sell(11);
    }

    #[test]
    #[should_panic(expected = "need")]
    fn underpay() {
        let mut c = setup();
        ctx(1, BASE_PRICE - 1, T0);
        c.buy(1);
    }

    #[test]
    fn feeding_burns_and_extends() {
        let mut c = setup();
        buy(&mut c, 1, 10, T0);
        let before = c.life.deadline;
        ctx(1, 0, T0 + 10);
        c.feed(3);
        assert_eq!(c.life.deadline, before + 3 * SECONDS_PER_TUMMO);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 7 * ONE_TUMMO);
        assert_eq!(c.ft_total_supply().0, 7 * ONE_TUMMO);
        assert_eq!(c.burned, 3);
        assert_eq!(c.life.feeders, 1);
    }

    #[test]
    fn capped_three_days_ahead() {
        let mut c = setup();
        buy(&mut c, 1, 5_000, T0);
        ctx(1, 0, T0);
        c.feed(5_000);
        assert_eq!(c.life.deadline, T0 + MAX_AHEAD);
    }

    #[test]
    fn grows_and_gets_hungrier() {
        assert_eq!(level_of(0), 0);
        assert_eq!(level_of(LEVEL_UNIT), 1);
        assert_eq!(level_of(4 * LEVEL_UNIT), 2);
        assert_eq!(seconds_per_tummo(0), 600);
        assert_eq!(seconds_per_tummo(2), 200);
        assert_eq!(seconds_per_tummo(1000), 10);
    }

    #[test]
    fn rescue_counts_double() {
        let mut c = setup();
        buy(&mut c, 1, 10, T0);
        ctx(1, 0, T0 + EGG_LIFE - 3600);
        c.feed(2);
        assert_eq!(c.get_feeder(accounts(1)).love.0, 4);
        assert_eq!(c.life.rescues, 1);
        assert_eq!(c.get_activity(Some(1))[0].kind, "rescue");
    }

    #[test]
    fn drip_pays_feeders_by_love() {
        let mut c = setup();
        buy(&mut c, 1, 300, T0);
        buy(&mut c, 2, 100, T0);
        ctx(1, 0, T0);
        c.feed(300);
        ctx(2, 0, T0);
        c.feed(100);
        let treasury = c.treasury;
        ctx(3, 0, T0 + 86_400);
        c.tick();
        let paid = treasury - c.treasury;
        assert!(paid > 0);
        let a = c.get_feeder(accounts(1)).claimable.0;
        let b = c.get_feeder(accounts(2)).claimable.0;
        assert!(a > 0 && b > 0);
        assert!(a > b * 29 / 10 && a < b * 31 / 10);
        assert!(a + b <= paid);
        // roughly 3% a day
        assert!(paid * 10_000 / treasury >= 295 && paid * 10_000 / treasury <= 300);
    }

    #[test]
    fn no_drip_after_death() {
        let mut c = setup();
        buy(&mut c, 1, 10, T0);
        ctx(1, 0, T0);
        c.feed(1);
        let treasury = c.treasury;
        let deadline = c.life.deadline;
        ctx(2, 0, deadline + 10 * 86_400);
        c.bury();
        let paid = c.graves.get(0).unwrap().paid_out.0;
        let expected_max = treasury * DRIP_BPS_PER_DAY * (deadline - T0) as u128 / (10_000 * 86_400) + 1;
        assert!(paid <= expected_max);
        assert_eq!(c.life.id, 2);
        assert_eq!(c.life.deadline, deadline + 10 * 86_400 + EGG_LIFE);
    }

    #[test]
    fn death_buries_and_earnings_survive() {
        let mut c = setup();
        buy(&mut c, 1, 50, T0);
        ctx(1, 0, T0);
        c.feed(50);
        let die = c.life.deadline;
        ctx(2, 0, die - 100);
        c.tick();
        let owed = c.get_feeder(accounts(1)).claimable.0;
        assert!(owed > 0);
        ctx(2, 0, die + 1);
        c.bury();
        assert_eq!(c.get_graves(None).len(), 1);
        assert_eq!(c.get_graves(None)[0].top_feeder, Some(accounts(1)));
        let after = c.get_feeder(accounts(1));
        assert!(after.claimable.0 >= owed);
        assert_eq!(after.love.0, 0);
        assert!(!after.fed_this_life);
        assert!(c.top.is_empty());
        assert_eq!(c.get_activity(Some(1))[0].kind, "death");
        ctx(1, 0, die + 2);
        let _ = c.claim();
        assert_eq!(c.get_feeder(accounts(1)).claimable.0, 0);
    }

    #[test]
    #[should_panic(expected = "still alive")]
    fn cant_bury_alive() {
        let mut c = setup();
        ctx(1, 0, T0 + 5);
        c.bury();
    }

    fn as_named(name: &str, deposit: u128, t: u64) {
        let mut b = VMContextBuilder::new();
        b.current_account_id("tummo.testnet".parse().unwrap())
            .predecessor_account_id(name.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(t * SEC);
        testing_env!(b.build());
    }

    #[test]
    fn feast_needs_ten_real_feeders() {
        let mut c = setup();
        let names: Vec<String> = (0..10).map(|i| format!("f{}.testnet", i)).collect();
        for n in &names {
            as_named(n, c.quote(60).0, T0);
            c.buy(60);
        }
        // a fresh account and a small feed don't count
        as_named("fresh.testnet", c.quote(60).0, T0 + 3500);
        c.buy(60);
        let t = T0 + FEAST_MIN_AGE + 10;
        as_named("fresh.testnet", 0, t);
        c.feed(30);
        as_named(&names[0], 0, t);
        c.feed(FEAST_MIN_FEED - 1);
        assert_eq!(c.life.day_feeders, 0);
        for n in names.iter().take(9) {
            as_named(n, 0, t + 1);
            c.feed(FEAST_MIN_FEED);
        }
        assert_eq!(c.life.feasts, 0);
        assert_eq!(c.life.day_feeders, 9);
        let before = c.life.deadline;
        as_named(&names[9], 0, t + 2);
        c.feed(FEAST_MIN_FEED);
        assert_eq!(c.life.feasts, 1);
        assert_eq!(c.get_activity(Some(1))[0].kind, "feast");
        assert!(c.life.deadline > before);
        // once a day
        as_named("fresh.testnet", 0, T0 + 3600 * 2);
        c.feed(FEAST_MIN_FEED);
        assert_eq!(c.life.feasts, 1);
    }

    #[test]
    fn config_is_public_and_has_no_admin() {
        let c = setup();
        let k = c.get_config();
        assert_eq!(k.feast_feeders, FEAST_FEEDERS);
        assert_eq!(k.drip_bps_per_day.0, DRIP_BPS_PER_DAY);
        assert!(k.admin.is_none());
    }

    #[test]
    fn top_feeders_sorted() {
        let mut c = setup();
        buy(&mut c, 1, 5, T0);
        buy(&mut c, 2, 9, T0);
        ctx(1, 0, T0);
        c.feed(5);
        ctx(2, 0, T0);
        c.feed(9);
        let top = c.get_pet().top;
        assert_eq!(top[0].0, accounts(2));
        assert_eq!(top[1].0, accounts(1));
    }

    #[test]
    fn price_never_drops_when_burning() {
        let mut c = setup();
        buy(&mut c, 1, 100, T0);
        let p = c.quote(1).0;
        ctx(1, 0, T0);
        c.feed(100);
        assert_eq!(c.quote(1).0, p);
    }
}
