import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {

    constructor(network, callback) {
        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyApp.abi, config.dataAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passenger = null;
        this.passengers = [];
        this.accounts = [];
    }

    async initialize(callback) {
        this.web3.eth.getAccounts(async (error, accounts) => {

            this.owner = accounts[0];
            this.passenger = accounts[10];

            let counter = 1;
            while (this.airlines.length < 5) {
                this.airlines.push(accounts[counter++]);
            }

            while (this.passengers.length < 5) {
                this.passengers.push(accounts[counter++]);
            }

            try {
                await this.flightSuretyApp.methods.registerAirline(this.airlines[4], 'United Test Airline')
                    .send({from: this.owner, gas: 500000}, (error, result) => {
                        console.log(this.airlines[4] + ' registered');
                    });
                await this.flightSuretyData.methods.fund()
                    .send({from: this.airlines[4], value: 10000000000000000000, gas: 500000}, (error, result) => {
                        console.log(this.airlines[4] + ' funded');
                    });
                let payload = {
                    flight: 'ND1309',
                    timestamp: Math.floor(Date.now() / 1000)
                };
                await this.flightSuretyApp.methods
                    .registerFlight(payload.flight, payload.timestamp)
                    .send({
                        from: this.airlines[4],
                        gas: 500000,
                        gasPrice: 1
                    }, (error, result) => {
                        callback(error, payload);
                    });
            } catch (e) {
                console.log('United Test Airline is already registered, funded and a flight has been registered.')
            }

            callback();
        });
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({from: self.owner}, callback);
    }

    async fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[4],
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        }
        await self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    async viewFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[4],
            flight: flight
        }
        await self.flightSuretyApp.methods
            .viewFlightStatus(payload.flight, payload.airline)
            .call({from: self.owner}, (error, result) => {
                callback(error, result);
            });
    }

    async buy(flight, price, callback) {
        let self = this;
        let priceWei = this.web3.utils.toWei(price.toString(), "ether");
        let payload = {
            flight: flight,
            price: priceWei,
            passenger: this.passenger
        }
        await self.flightSuretyData.methods
            .buy(flight)
            .send({
                from: payload.passenger,
                value: priceWei,
                gas: 500000,
                gasPrice: 1
            }, (error, result) => {
                callback(error, payload);
            });
    }
}