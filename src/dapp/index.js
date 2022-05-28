import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        contract.isOperational((error, result) => {
            console.log(error, result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });

        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
                setTimeout(() => {
                    contract.viewFlightStatus(flight, (error, result) => {
                        if (!error) {
                            display('Oracles', 'Flight status', [ { label: 'Got Flight Status', error: error, value: 'Status code: ' + result} ]);
                        }
                    });
                }, 1000);
            });
        });

        DOM.elid('buy-insurance').addEventListener('click', () => {
            let flight = DOM.elid('insurance-flight').value;
            let price = DOM.elid('insurance-amount').value;
            contract.buy(flight, price, (error, result) => {
                display('', 'Bought a flight insurance', [ { label: 'Insurance info', error: error, value: `Flight: ${result.flight}. Paid: ${result.price} wei. Passenger: ${result.passenger}`} ]);
            });
        })
    });

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







