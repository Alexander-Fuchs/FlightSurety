var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, {from: config.testAddresses[2]});
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false);
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await config.flightSurety.setTestingMode(true);
        } catch (e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });

    it('(airline) cannot register an airlines if it is not funded', async () => {
        let newAirline = accounts[2];
        try {
            await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
        } catch (e) {
        }
        let result = await config.flightSuretyData.isAirlineActive.call(newAirline);
        assert.equal(result, false, "airlines should not be able to register another airline if it hasn't provided funding");
    });

    it("(airline) can register an airlines directly without voting", async () => {
        try {
            let funds = await config.flightSuretyData.MIN_FUNDS.call();
            await config.flightSuretyData.fund({
                from: accounts[0],
                value: funds
            });
            await config.flightSuretyApp.registerAirline(
                accounts[2],
                "Test Airline 2",
                { from: accounts[0] }
            );
        } catch (e) {
        }
        let result = await config.flightSuretyData.isAirlineRegistered.call(accounts[2]);
        let totalAirlines = await config.flightSuretyData.getAllAirlines.call();
        assert.equal(result, true, "One airline should be able to register another one until 4 has been reached");
        assert.equal(totalAirlines, 2, "Total airlines should be one more after deployment");
    });

    it("(airline) needs 50% of votes to register a new airlines if more than 4 airlines have been registered", async () => {
        let resultBeforeVote = false;
        let resultAfterVote = false;
        try {
            await config.flightSuretyApp.registerAirline(
                accounts[3],
                "Test Airline 3",
                { from: config.firstAirline }
            );
            await config.flightSuretyApp.registerAirline(
                accounts[4],
                "Test Airline 4",
                { from: config.firstAirline }
            );
            await config.flightSuretyApp.registerAirline(
                accounts[5],
                "Test Airline 5",
                { from: config.firstAirline }
            );
            resultBeforeVote = await config.flightSuretyData.isAirlineActive.call(
                accounts[5]
            );
            await config.flightSuretyData.submitAirlineVote(accounts[5], {
                from: accounts[2]
            });
            await config.flightSuretyData.submitAirlineVote(accounts[5], {
                from: accounts[3]
            });
            resultAfterVote = await config.flightSuretyData.isAirlineActive.call(
                accounts[5]
            );
        } catch (e) {
            console.log(e);
        }
        assert.equal(resultBeforeVote, false, "The airline has not yet been accepted / voted for");
        assert.equal(resultAfterVote, true, "The airline has been accepted");
    });

    it("(airline) can register a flight", async () => {
        timestamp = Math.floor(Date.now() / 1000);
        try {
            await config.flightSuretyApp.registerFlight("ND1309", timestamp, { from: config.firstAirline });
        } catch (e) {
        }
    });

    it("(passenger) can pay up to 1 ether to buy flight insurance", async () => {
        let price = await config.flightSuretyData.MAX_INSURANCE_AMT.call();
        try {
            await config.flightSuretyData.buy("ND1309", {
                from: accounts[10],
                value: price
            });
        } catch (e) {
        }
        let isPassenger = await config.flightSuretyData.isPassenger.call(accounts[10]);
        assert.equal(isPassenger, true, "Passenger has been registered");
    });

    it("(oracles) are registered on startup and indexes are persisted in memory", async () => {
        let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();
        for (let a = 0; a < 20; a++) {
            await config.flightSuretyApp.registerOracle({
                from: accounts[a],
                value: fee
            });
            let result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
            assert.equal(result.length, 3, "Oracle should be registered with three indexes");
        }
    });

    it("(oracles) are looped through and a flight will be updated with a status code", async () => {
        let flight = "ND1309";
        let timestamp = Math.floor(Date.now() / 1000);
        await config.flightSuretyApp.fetchFlightStatus(
            config.firstAirline,
            flight,
            timestamp
        );
        for (let a = 0; a < 20; a++) {
            let oracleIndexes = await config.flightSuretyApp.getMyIndexes({
                from: accounts[a],
            });
            for (let idx = 0; idx < 3; idx++) {
                try {
                    await config.flightSuretyApp.submitOracleResponse(
                        oracleIndexes[idx],
                        config.firstAirline,
                        flight,
                        timestamp,
                        20,
                        { from: accounts[a] }
                    );
                } catch (e) {
                }
            }
        }
        let flightStatus = await config.flightSuretyApp.viewFlightStatus(flight, config.firstAirline);
        assert.equal(flightStatus.toString(), 20, "Oracle should change flight status code to 20");
    });

    it("(passenger) receives credit of 1.5x the paid amount, if flight is delayed", async () => {
        let price = await config.flightSuretyData.MAX_INSURANCE_AMT.call();
        let creditToPay = await config.flightSuretyData.getCredit.call({
            from: accounts[10]
        });
        assert.equal(creditToPay, (price * 1.5), "Passenger should have 1.5 times the ether paid");
    });

    it("(passenger) can withdraw credits", async () => {
        let creditToPay = await config.flightSuretyData.getCredit.call({
            from: accounts[10]
        });
        let passengerCredit = await web3.eth.getBalance(accounts[10]);
        await config.flightSuretyData.pay(accounts[10]);
        let passengerFinalCredit = await web3.eth.getBalance(accounts[10]);
        let passengerCreditLeft = await config.flightSuretyData.getCredit.call({
            from: accounts[10]
        });
        assert.equal(passengerCreditLeft.toString(), 0, "Passenger should have no credit left");
        assert.equal(Number(passengerCredit) + Number(creditToPay), Number(passengerFinalCredit),
            "Passengers wallet balance should have increased the amount of the paid credit"
        );
    });
});
