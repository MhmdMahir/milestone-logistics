import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, OverlayTrigger, Tooltip } from 'react-bootstrap';

const defaultAgreements = [
  {
    id: 1,
    title: "Milestone Logistics Escrow #1041",
    amount: "1.5 ETH",
    carrier: "DHL Express",
    shipper: "Maersk Global",
    requiresAttention: true,
    tooltipText: "Action Needed: Milestone 2 awaits your approval"
  },
  {
    id: 2,
    title: "Freight Delivery Service #1042",
    amount: "4.2 ETH",
    carrier: "FedEx Supply",
    shipper: "Amazon Logistics",
    requiresAttention: false,
    tooltipText: "No Action Needed: Order operating normally"
  },
  {
    id: 3,
    title: "Customs Clearance Contract #1043",
    amount: "0.8 ETH",
    carrier: "UPS Worldwide",
    shipper: "Kuehne + Nagel",
    requiresAttention: true,
    tooltipText: "Action Needed: Evidence submission requested"
  }
];

function CardList({ agreements = defaultAgreements, onCardClick }) {
  const navigate = useNavigate();

  const handleCardClick = (item) => {
    if (onCardClick) {
      onCardClick(item);
    } else {
      navigate(`/agreement/${item.id}`);
    }
  };

  return (
    <Row className="g-4">
      {agreements.map((item) => (
        <Col key={item.id} xs={12} md={6} lg={4}>
          <Card
            className="position-relative shadow-sm h-100 border-secondary-subtle"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out' }}
            onClick={() => handleCardClick(item)}
          >
            {/* Top-right Notification Dot with Tooltip */}
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id={`tooltip-dot-${item.id}`}>
                  {item.tooltipText}
                </Tooltip>
              }
            >
              <span
                className={`position-absolute rounded-circle border border-2 border-white ${
                  item.requiresAttention ? 'bg-danger' : 'bg-success'
                }`}
                style={{
                  top: '12px',
                  right: '12px',
                  width: '14px',
                  height: '14px',
                  zIndex: 3,
                  boxShadow: item.requiresAttention ? '0 0 6px rgba(245, 101, 101, 0.9)' : 'none'
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </OverlayTrigger>

            <Card.Body className="d-flex flex-column justify-content-between p-4">
              <div>
                {/* Title */}
                <Card.Title className="h5 fw-bold mb-2 pe-3 text-truncate">
                  {item.title}
                </Card.Title>

                {/* Amount (Black Color) */}
                <div className="mb-3">
                  <span className="text-muted d-block small">Amount</span>
                  <span className="fs-5 fw-bold text-dark">{item.amount}</span>
                </div>

                {/* 2 Small Info Placeholders: Carrier and Shipper (No divider line) */}
                <div className="row g-2 pt-1">
                  <div className="col-6">
                    <span className="text-muted d-block small">Carrier</span>
                    <span className="small fw-semibold text-dark text-truncate d-block">
                      {item.carrier}
                    </span>
                  </div>
                  <div className="col-6 text-end">
                    <span className="text-muted d-block small">Shipper</span>
                    <span className="small fw-semibold text-dark text-truncate d-block">
                      {item.shipper}
                    </span>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

export default CardList;
