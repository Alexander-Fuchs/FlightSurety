pragma solidity ^0.5.0;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => uint256) private authorizedContracts;
    enum AirlineStatus {
        INACTIVE,
        REGISTERED,
        ACTIVE
    }
    struct Airline {
        address airline;
        string name;
        AirlineStatus status;
        uint256 funds;
        address[] votes;
    }
    mapping(address => Airline) public airlines;
    uint256 public totalAirlines;

    struct Flight {
        bool isRegistered;
        address airline;
        uint8 statusCode;
        string flight;
        uint256 timestamp;
    }
    mapping(bytes32 => Flight) private flights;

    struct Passenger {
        address passenger;
        uint256 credit;
        mapping(string => uint256) insuredFlights;
    }
    mapping(address => Passenger) private passengers;
    address[] public passengerAddresses;

    uint256 public constant MIN_FUNDS = 10 ether;
    uint256 public constant MAX_INSURANCE_AMT = 1 ether;

    event AirlineActiveEvent(address airline, uint256 totalAirlines, string trigger);

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() public {
        contractOwner = msg.sender;
        airlines[msg.sender] = Airline({
            airline: msg.sender,
            status: AirlineStatus.ACTIVE,
            name: "Master Airline",
            funds: 0,
            votes: new address[](0)
        });
        totalAirlines = 1;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireNotRegistered(address airline)
    {
        require(!(airlines[airline].airline == airline), "Airline is already registered");
        _;
    }

    modifier requireIsRegistered(address airline)
    {
        require(isAirlineRegistered(airline), "Airline is unregistered");
        _;
    }

    modifier requireIsActive(address airline)
    {
        require(isAirlineActive(airline), "Airline is not active");
        _;
    }

    modifier requirePassengerIsInsured(address passenger)
    {
        require(passengers[passenger].passenger == passenger, "Passenger is not insured");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool)
    {
        return operational;
    }

    function isAirlineRegistered(address airlineAddr) public view returns (bool)
    {
        return (airlines[airlineAddr].status == AirlineStatus.REGISTERED || airlines[airlineAddr].status == AirlineStatus.ACTIVE);
    }

    function isAirlineActive(address airlineAddr) public view returns (bool)
    {
        return airlines[airlineAddr].status == AirlineStatus.ACTIVE;
    }

    function isPassenger(address passenger) public view returns (bool)
    {
        return passengers[passenger].passenger == passenger;
    }

    function getCredit() external view returns (uint256)
    {
        return passengers[msg.sender].credit;
    }

    function getFlightStatus(address airline, string calldata flight) external view returns(uint8)
    {
        bytes32 key = keccak256(abi.encodePacked(flight, airline));
        return flights[key].statusCode;
    }

    function getAllAirlines() public view returns (int)
    {
        return int(totalAirlines);
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(
        bool mode
    ) external requireContractOwner {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(
            address airlineAddress,
            string calldata airlineName
        )
        external
        requireIsOperational
        requireNotRegistered(airlineAddress)
        returns (bool)
    {
        airlines[airlineAddress] = Airline({
            airline: airlineAddress,
            name: airlineName,
            status: totalAirlines < 4 ? AirlineStatus.ACTIVE : AirlineStatus.REGISTERED,
            funds: 0,
            votes: new address[](0)
        });
        if (totalAirlines < 4) {
            totalAirlines++;
            emit AirlineActiveEvent(airlineAddress, totalAirlines, 'below_threshold');
        }
        return airlines[airlineAddress].status == AirlineStatus.ACTIVE;
    }

    function submitAirlineVote(
        address airline
    ) external requireIsOperational requireIsActive(msg.sender) {
        bool hasVoted = false;
        uint256 len = airlines[airline].votes.length;
        for (uint256 i = 0; i < len; i++) {
            if (airlines[airline].votes[i] == msg.sender){
                hasVoted = true;
                break;
            }
        }
        require(!hasVoted, "Vote has already been counted by this caller");
        airlines[airline].votes.push(msg.sender);
        if (airlines[airline].votes.length >= totalAirlines.div(2) && airlines[airline].status != AirlineStatus.ACTIVE) {
            totalAirlines++;
            airlines[airline].status = AirlineStatus.ACTIVE;
            emit AirlineActiveEvent(airline, totalAirlines, 'voting');
        }
    }

    function registerFlight(
        address airlineAddress,
        string calldata flight,
        uint256 timestamp,
        uint8 statusCode
    ) external requireIsOperational requireIsActive(airlineAddress) returns (bool) {
        bytes32 flightKey = keccak256(abi.encodePacked(flight, airlineAddress));
        flights[flightKey] = Flight({
            isRegistered: true,
            airline: airlineAddress,
            statusCode: statusCode,
            flight: flight,
            timestamp: timestamp
        });
        return flights[flightKey].isRegistered;
    }

    function updateFlightStatus(uint8 statusCode, uint256 timestamp, bytes32 flightKey) external requireIsOperational {
        flights[flightKey].statusCode = statusCode;
        flights[flightKey].timestamp = timestamp;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy(
        string calldata flight
    ) external payable requireIsOperational {
        if (passengers[msg.sender].passenger != msg.sender) {
            passengers[msg.sender] = Passenger({
                passenger: msg.sender,
                credit: 0
            });
            passengerAddresses.push(msg.sender);
        }
        require(passengers[msg.sender].insuredFlights[flight] == 0, "Insurance for flight already paid");
        passengers[msg.sender].insuredFlights[flight] = msg.value;
        if (msg.value > MAX_INSURANCE_AMT) {
            msg.sender.transfer(msg.value.sub(MAX_INSURANCE_AMT));
        }
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(
        string calldata flight
    ) external requireIsOperational {
        for (uint256 i = 0; i < passengerAddresses.length; i++) {
            address passengerAddr = passengerAddresses[i];
            Passenger storage passenger = passengers[passengerAddr];
            uint256 insurancePrice = passenger.insuredFlights[flight];
            if (insurancePrice > 0) {
                passengers[passengerAddr].insuredFlights[flight] = 0;
                passengers[passengerAddr].credit = passenger.credit + insurancePrice + insurancePrice.div(2);
            }
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(
        address passengerAddr
    ) external payable requirePassengerIsInsured(passengerAddr) requireIsOperational {
        Passenger storage passenger = passengers[passengerAddr];
        require(passenger.credit > 0, "No credit left");
        uint256 passengerCredit = passenger.credit;
        passengers[passengerAddr].credit = 0;
        address(uint160(passengerAddr)).transfer(passengerCredit);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund() public payable requireIsOperational {
        uint256 currentFunds = airlines[msg.sender].funds;
        airlines[msg.sender].funds = currentFunds.add(msg.value);
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function authorizeCaller(
        address contractAddress
    ) external requireContractOwner {
        authorizedContracts[contractAddress] = 1;
    }
}

