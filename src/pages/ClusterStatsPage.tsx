import React from "react";
import {TableCardBody} from "components/common/TableCardBody";
import {Slot} from "components/common/Slot";
import {
  ClusterStatsStatus,
  useDashboardInfo,
  usePerformanceInfo,
  useStatsProvider,
} from "providers/stats/solanaClusterStats";
import {lamportsToSol, slotsToHumanString} from "utils";
import {ClusterStatus, useCluster} from "providers/cluster";
import {TpsCard} from "components/TpsCard";
import {displayTimestampUtc, displayTimestampWithoutDate} from "utils/date";
import {Status, useFetchSupply, useSupply} from "providers/supply";
import {PublicKey} from "@velas/web3";
import {ErrorCard} from "components/common/ErrorCard";
import {LoadingCard} from "components/common/LoadingCard";
import {useAccountInfo, useFetchAccountInfo} from "providers/accounts";
import {FetchStatus} from "providers/cache";
import {useVoteAccounts} from "providers/accounts/vote-accounts";
// @ts-ignore
import * as CoinGecko from "coingecko-api";
// icons
import supplyIconLight from "../img/staking-card/supply-light.png";
import supplyIconDark from "../img/staking-card/supply-dark.png";
import stakeIconLight from "../img/staking-card/stake-light.png";
import stakeIconDark from "../img/staking-card/stake-dark.png";
import priceIconLight from "../img/staking-card/price-light.png";
import priceIconDark from "../img/staking-card/price-dark.png";
import stakeGraph from "../img/staking-card/stake-graph.png";
import supplyGraph from "../img/staking-card/supply-graph.png";
import priceGraph from "../img/staking-card/price-graph.png";
import {ThemeMode} from "../index";

enum CoingeckoStatus {
  Success,
  FetchFailed,
}

const CoinGeckoClient = new CoinGecko();

const CLUSTER_STATS_TIMEOUT = 5000;
const STAKE_HISTORY_ACCOUNT = "SysvarStakeHistory1111111111111111111111111";
const PRICE_REFRESH = 10000;

export function ClusterStatsPage(props: {themeMode: ThemeMode}) {
  const {themeMode} = props;
  return (
    <div className="container-fluid mt-4">
      <div className="row">
        <div className="col-12">
          <h3 className="mt-3 card-title">CURRENT STATUS</h3>
          <StakingComponent themeMode={themeMode}/>
        </div>
        <div className="col-12 col-xl-7">
          <h3 className="mt-3 card-title">LIVE CLUSTER STATS</h3>
          <div className="card">
            <StatsCardBody />
          </div>
        </div>
        <div className="col-12 col-xl-5">
          <TpsCard />
        </div>
      </div>
    </div>
  );
}

function StakingComponent(props: {themeMode: ThemeMode}) {
  const { themeMode } = props;
  const { status } = useCluster();
  const supply = useSupply();
  const fetchSupply = useFetchSupply();
  const fetchAccount = useFetchAccountInfo();
  const stakeInfo = useAccountInfo(STAKE_HISTORY_ACCOUNT);
  const coinInfo = useCoinGecko("velas");
  const { fetchVoteAccounts, voteAccounts } = useVoteAccounts();

  function fetchData() {
    fetchSupply();
    fetchAccount(new PublicKey(STAKE_HISTORY_ACCOUNT));
    fetchVoteAccounts();
  }

  React.useEffect(() => {
    if (status === ClusterStatus.Connected) {
      fetchData();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const deliquentStake = React.useMemo(() => {
    if (voteAccounts) {
      return voteAccounts.delinquent.reduce(
        (prev, current) => prev + current.activatedStake,
        0
      );
    }
  }, [voteAccounts]);

  let stakeHistory = stakeInfo?.data?.details?.data?.parsed.info;

  if (supply === Status.Disconnected) {
    // we'll return here to prevent flicker
    return null;
  }

  if (
    supply === Status.Idle ||
    supply === Status.Connecting ||
    !stakeInfo ||
    !stakeHistory ||
    !coinInfo
  ) {
    return <LoadingCard />;
  } else if (typeof supply === "string") {
    return <ErrorCard text={supply} retry={fetchData} />;
  } else if (
    stakeInfo.status === FetchStatus.FetchFailed ||
    (stakeInfo.status === FetchStatus.Fetched &&
      (!stakeHistory.length || stakeHistory.length < 1))
  ) {
    return (
      <ErrorCard text={"Failed to fetch active stake"} retry={fetchData} />
    );
  }

  stakeHistory = stakeHistory[0].stakeHistory;

  const circulatingPercentage = (
    (supply.circulating / supply.total) *
    100
  ).toFixed(1);

  let delinquentStakePercentage;
  if (deliquentStake) {
    delinquentStakePercentage = (
      (deliquentStake / stakeHistory.effective) *
      100
    ).toFixed(1);
  }

  let solanaInfo;
  if (coinInfo.status === CoingeckoStatus.Success) {
    solanaInfo = coinInfo.coinInfo;
  }

  // @ts-ignore
  // @ts-ignore
  return (
    // <div className="card staking-card">
    //   <div className="card-body">
    //     <div className="d-flex flex-md-row flex-column">
    //       <div className="p-2 flex-fill">
    //         <h4>Circulating Supply</h4>
    //         <h1>
    //           <em>{displayLamports(supply.circulating)}</em> /{" "}
    //           <small>{displayLamports(supply.total)}</small>
    //         </h1>
    //         <h5>
    //           <em>{circulatingPercentage}%</em> is circulating
    //         </h5>
    //       </div>
    //       <hr className="hidden-sm-up" />
    //       <div className="p-2 flex-fill">
    //         <h4>Active Stake</h4>
    //         <h1>
    //           <em>{displayLamports(stakeHistory.effective)}</em> /{" "}
    //           <small>{displayLamports(supply.total)}</small>
    //         </h1>
    //         {delinquentStakePercentage && (
    //           <h5>
    //             Delinquent stake: <em>{delinquentStakePercentage}%</em>
    //           </h5>
    //         )}
    //       </div>
    //       <hr className="hidden-sm-up" />
    //       {solanaInfo && (
    //         <div className="p-2 flex-fill">
    //           <h4>
    //             Price{" "}
    //             <span className="ml-2 badge badge-primary rank">
    //               Rank #{solanaInfo.market_cap_rank}
    //             </span>
    //           </h4>
    //           <h1>
    //             <em>${solanaInfo.price.toFixed(2)}</em>{" "}
    //             {solanaInfo.price_change_percentage_24h > 0 && (
    //               <small className="change-positive">
    //                 &uarr; {solanaInfo.price_change_percentage_24h.toFixed(2)}%
    //               </small>
    //             )}
    //             {solanaInfo.price_change_percentage_24h < 0 && (
    //               <small className="change-negative">
    //                 &darr; {solanaInfo.price_change_percentage_24h.toFixed(2)}%
    //               </small>
    //             )}
    //             {solanaInfo.price_change_percentage_24h === 0 && (
    //               <small>0%</small>
    //             )}
    //           </h1>
    //           <h5>
    //             24h Vol: <em>${abbreviatedNumber(solanaInfo.volume_24)}</em>{" "}
    //             MCap: <em>${abbreviatedNumber(solanaInfo.market_cap)}</em>
    //           </h5>
    //         </div>
    //       )}
    //       {coinInfo.status === CoingeckoStatus.FetchFailed && (
    //         <div className="p-2 flex-fill">
    //           <h4>Price</h4>
    //           <h1>
    //             <em>$--.--</em>
    //           </h1>
    //           <h5>Error fetching the latest price information</h5>
    //         </div>
    //       )}
    //     </div>
    //     {solanaInfo && (
    //       <p className="updated-time text-muted mb-0">
    //         Updated at{" "}
    //         {displayTimestampWithoutDate(solanaInfo.last_updated.getTime())}
    //       </p>
    //     )}
    //   </div>
    // </div>
    <div className="row staking-card">
      <div className="col-12 col-lg-4 col-xl">
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-start align-items-center">
              <div className="mr-4">
                <img src={themeMode === ThemeMode.light ? supplyIconLight : supplyIconDark} alt="circulating supply"/>
              </div>
              <div>
                <h6>Circulating Supply
                <span className="ml-2 badge badge-primary rank" style={{opacity: 0.0}}>{displayLamports(supply.circulating)}</span>
                </h6>
                <h1>
                  <em>{displayLamports(supply.circulating)}</em> /{" "}
                  <small>{displayLamports(supply.total)}</small>
                </h1>
                <div className="d-flex justify-content-start align-items-center">
                  <img src={supplyGraph} alt="circulating supply graph" className="mr-3"/>
                  <h5>
                    <em>{circulatingPercentage}%</em> is circulating
                  </h5>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="col-12 col-lg-4 col-xl">
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-start align-items-center">
              <div className="mr-4">
                <img src={ themeMode === ThemeMode.light ? stakeIconLight : stakeIconDark } alt="active state"/>
              </div>
              <div>
                <h6>Active Stake{" "}
                  <span className="ml-2 badge badge-primary rank" style={{opacity: 0.0}}>{displayLamports(stakeHistory.effective)}</span>
                </h6>
                <h1>
                  <em>{displayLamports(stakeHistory.effective)}</em> /{" "}
                  <small>{displayLamports(supply.total)}</small>
                </h1>
                <div className="d-flex justify-content-start align-items-center">
                  <img src={stakeGraph} alt="active state graph" className="mr-3"/>
                  {delinquentStakePercentage && (
                    <h5>
                      Delinquent stake: <em>{delinquentStakePercentage}%</em>
                    </h5>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="col-12 col-lg-4 col-xl">
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-start align-items-center">
              <div className="mr-4">
                <img src={ themeMode === ThemeMode.light ? priceIconLight : priceIconDark } alt="price"/>
              </div>
              <div>
                {solanaInfo && (
                  <>
                    <h6>
                      Price{" "}
                      <span className="ml-2 badge badge-primary rank">
                        Rank #{solanaInfo.market_cap_rank}
                      </span>
                    </h6>
                    <h1>
                      <em>${solanaInfo.price.toFixed(2)}</em>{" "}
                      {solanaInfo.price_change_percentage_24h > 0 && (
                        <small className="change-positive">
                          &uarr; {solanaInfo.price_change_percentage_24h.toFixed(2)}
                          %
                        </small>
                      )}
                      {solanaInfo.price_change_percentage_24h < 0 && (
                        <small className="change-negative">
                          &darr; {solanaInfo.price_change_percentage_24h.toFixed(2)}
                          %
                        </small>
                      )}
                      {solanaInfo.price_change_percentage_24h === 0 && (
                        <small>0%</small>
                      )}
                    </h1>
                    <div className="d-flex justify-content-start align-items-center">
                      <img src={priceGraph} alt="price" className="mr-3"/>
                      <h5>
                        24h Vol: <em>${abbreviatedNumber(solanaInfo.volume_24)}</em>{" "}
                        MCap: <em>${abbreviatedNumber(solanaInfo.market_cap)}</em>
                      </h5>
                    </div>
                  </>
                )}
                {coinInfo.status === CoingeckoStatus.FetchFailed && (
                  <>
                    <h6>Price</h6>
                    <h1>
                      <em>$--.--</em>
                    </h1>
                    <div className="d-flex justify-content-start align-items-center">
                      <img src={priceGraph} alt="price" className="mr-3"/>
                      <h5>Error fetching the latest price information</h5>
                    </div>
                  </>
                )}
                {solanaInfo && (
                  <p className="updated-time text-muted">
                    Updated at{" "}
                    {displayTimestampWithoutDate(solanaInfo.last_updated.getTime())}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const abbreviatedNumber = (value: number, fixed = 1) => {
  if (value < 1e3) return value;
  if (value >= 1e3 && value < 1e6) return +(value / 1e3).toFixed(fixed) + "K";
  if (value >= 1e6 && value < 1e9) return +(value / 1e6).toFixed(fixed) + "M";
  if (value >= 1e9 && value < 1e12) return +(value / 1e9).toFixed(fixed) + "B";
  if (value >= 1e12) return +(value / 1e12).toFixed(fixed) + "T";
};

function displayLamports(value: number) {
  return abbreviatedNumber(lamportsToSol(value));
}

function StatsCardBody() {
  const dashboardInfo = useDashboardInfo();
  const performanceInfo = usePerformanceInfo();
  const { setActive } = useStatsProvider();
  const { cluster } = useCluster();

  React.useEffect(() => {
    setActive(true);
    return () => setActive(false);
  }, [setActive, cluster]);

  if (
    performanceInfo.status !== ClusterStatsStatus.Ready ||
    dashboardInfo.status !== ClusterStatsStatus.Ready
  ) {
    const error =
      performanceInfo.status === ClusterStatsStatus.Error ||
      dashboardInfo.status === ClusterStatsStatus.Error;
    return <StatsNotReady error={error} />;
  }

  const {
    avgSlotTime_1h,
    avgSlotTime_1min,
    epochInfo,
    blockTime,
  } = dashboardInfo;
  const hourlySlotTime = Math.round(1000 * avgSlotTime_1h);
  const averageSlotTime = Math.round(1000 * avgSlotTime_1min);
  const { slotIndex, slotsInEpoch } = epochInfo;
  const currentEpoch = epochInfo.epoch.toString();
  const epochProgress = ((100 * slotIndex) / slotsInEpoch).toFixed(1) + "%";
  const epochTimeRemaining = slotsToHumanString(
    slotsInEpoch - slotIndex,
    hourlySlotTime
  );
  const { blockHeight, absoluteSlot } = epochInfo;

  return (
    <TableCardBody>
      <tr>
        <td className="w-100">Slot</td>
        <td className="text-lg-right text-monospace">
          <Slot slot={absoluteSlot} link />
        </td>
      </tr>
      {blockHeight !== undefined && (
        <tr>
          <td className="w-100">Block height</td>
          <td className="text-lg-right text-monospace">
            <Slot slot={blockHeight} />
          </td>
        </tr>
      )}
      {blockTime && (
        <tr>
          <td className="w-100">Cluster time</td>
          <td className="text-lg-right text-monospace">
            {displayTimestampUtc(blockTime)}
          </td>
        </tr>
      )}
      <tr>
        <td className="w-100">Slot time (1min average)</td>
        <td className="text-lg-right text-monospace">{averageSlotTime}ms</td>
      </tr>
      <tr>
        <td className="w-100">Slot time (1hr average)</td>
        <td className="text-lg-right text-monospace">{hourlySlotTime}ms</td>
      </tr>
      <tr>
        <td className="w-100">Epoch</td>
        <td className="text-lg-right text-monospace">{currentEpoch}</td>
      </tr>
      <tr>
        <td className="w-100">Epoch progress</td>
        <td className="text-lg-right text-monospace">{epochProgress}</td>
      </tr>
      <tr>
        <td className="w-100">Epoch time remaining (approx.)</td>
        <td className="text-lg-right text-monospace">~{epochTimeRemaining}</td>
      </tr>
    </TableCardBody>
  );
}

export function StatsNotReady({ error }: { error: boolean }) {
  const { setTimedOut, retry, active } = useStatsProvider();
  const { cluster } = useCluster();

  React.useEffect(() => {
    let timedOut = 0;
    if (!error) {
      timedOut = setTimeout(setTimedOut, CLUSTER_STATS_TIMEOUT);
    }
    return () => {
      if (timedOut) {
        clearTimeout(timedOut);
      }
    };
  }, [setTimedOut, cluster, error]);

  if (error || !active) {
    return (
      <div className="card-body text-center">
        There was a problem loading cluster stats.{" "}
        <button
          className="btn btn-white btn-sm"
          onClick={() => {
            retry();
          }}
        >
          <span className="fe fe-refresh-cw mr-2"></span>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="card-body text-center">
      <span className="spinner-grow spinner-grow-sm mr-2"></span>
      Loading
    </div>
  );
}

interface CoinInfo {
  price: number;
  volume_24: number;
  market_cap: number;
  price_change_percentage_24h: number;
  market_cap_rank: number;
  last_updated: Date;
}

interface CoinInfoResult {
  data: {
    market_data: {
      current_price: {
        usd: number;
      };
      total_volume: {
        usd: number;
      };
      market_cap: {
        usd: number;
      };
      price_change_percentage_24h: number;
      market_cap_rank: number;
    };
    last_updated: string;
  };
}

type CoinGeckoResult = {
  coinInfo?: CoinInfo;
  status: CoingeckoStatus;
};

function useCoinGecko(coinId: string): CoinGeckoResult | undefined {
  const [coinInfo, setCoinInfo] = React.useState<CoinGeckoResult>();

  React.useEffect(() => {
    const getCoinInfo = () => {
      CoinGeckoClient.coins
        .fetch("velas")
        .then((info: CoinInfoResult) => {
          setCoinInfo({
            coinInfo: {
              price: info.data.market_data.current_price.usd,
              volume_24: info.data.market_data.total_volume.usd,
              market_cap: info.data.market_data.market_cap.usd,
              market_cap_rank: info.data.market_data.market_cap_rank,
              price_change_percentage_24h:
                info.data.market_data.price_change_percentage_24h,
              last_updated: new Date(info.data.last_updated),
            },
            status: CoingeckoStatus.Success,
          });
        })
        .catch((error: any) => {
          setCoinInfo({
            status: CoingeckoStatus.FetchFailed,
          });
        });
    };

    getCoinInfo();
    const interval = setInterval(() => {
      getCoinInfo();
    }, PRICE_REFRESH);

    return () => {
      clearInterval(interval);
    };
  }, [setCoinInfo]);

  return coinInfo;
}